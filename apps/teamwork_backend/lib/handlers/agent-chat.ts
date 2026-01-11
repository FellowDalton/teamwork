// lib/handlers/agent-chat.ts
// Main agent chat handler - routes to specialized handlers

import type { TeamworkClient } from "../teamwork_api_client/index.ts";
import { corsHeaders } from '../utils/response.ts';
import { validateAgentResponse } from '../utils/safety.ts';
import { runAgenticStatusAgent } from '../agents/agentic-status.ts';
import { handleTimelogChat } from './timelog.ts';
import { handleProjectChat } from './project.ts';

export interface AgentChatBody {
  message: string;
  mode?: "status" | "timelog" | "project" | "general";
  projectId?: number;
  projectName?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface AgentChatDependencies {
  query: any;
  claudeCodePath: string | undefined;
  teamworkMcpServer: any;
  teamwork: TeamworkClient;
  createSdkMcpServer: any;
  tool: any;
  ALLOWED_PROJECTS: Array<{ id: number; name: string }>;
}

export async function handleAgentChat(
  body: AgentChatBody,
  deps: AgentChatDependencies
) {
  const { message, mode = "general", projectId, projectName, conversationHistory } = body;
  const { query, claudeCodePath, teamworkMcpServer, teamwork, createSdkMcpServer, tool, ALLOWED_PROJECTS } = deps;

  if (!message) {
    return new Response("Message is required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Route to specialized handlers based on mode
  if (mode === "timelog") {
    return handleTimelogChat(
      { ...body, conversationHistory },
      { query, claudeCodePath, teamworkMcpServer, ALLOWED_PROJECTS }
    );
  }

  if (mode === "project") {
    return handleProjectChat(
      body,
      { query, claudeCodePath, teamworkMcpServer, teamwork, createSdkMcpServer, tool, ALLOWED_PROJECTS }
    );
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const safeEnqueue = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (e) {
            closed = true;
          }
        }
      };

      const safeClose = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      };

      try {
        console.log("=== AGENTIC STATUS FLOW ===");
        console.log("Mode:", mode, "| Message:", message.slice(0, 50));

        // Initialize - Claude will reason about what data to fetch
        safeEnqueue(
          `data: ${JSON.stringify({
            type: "init",
            model: "agentic-status",
            info: "Analyzing your question...",
          })}\n\n`
        );

        // Run the agentic status agent - Claude reasons about dates and fetches data
        const { text: chatResult, visualizations: vizSpecs } = await runAgenticStatusAgent(
          {
            question: message,
            projectId,
            projectName,
          },
          (thinking) => {
            // Stream thinking for accumulated display in UI
            safeEnqueue(
              `data: ${JSON.stringify({ type: "thinking", thinking })}\n\n`
            );
          },
          undefined,
          query,
          claudeCodePath,
          teamworkMcpServer
        );

        console.log("Agentic Agent completed:", chatResult?.length || 0, "chars");
        console.log(
          "Visualizations returned:",
          vizSpecs ? `${vizSpecs.length} visualizations` : "none"
        );

        // SAFETY VALIDATION: Check agent response for any unsafe patterns
        const validation = validateAgentResponse(chatResult || "");
        if (!validation.safe) {
          console.error(
            "SAFETY: Blocked unsafe status agent response:",
            validation.warning
          );
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "error",
              error: "Safety check failed. Please try again.",
            })}\n\n`
          );
          safeClose();
          return;
        }

        // Send final result
        safeEnqueue(
          `data: ${JSON.stringify({
            type: "result",
            text: chatResult,
            final: true,
          })}\n\n`
        );

        // Send ALL visualizations from the agent
        if (vizSpecs && Array.isArray(vizSpecs)) {
          for (const spec of vizSpecs) {
            console.log("Sending visualization:", spec.type);
            safeEnqueue(
              `data: ${JSON.stringify({
                type: "visualization",
                spec: spec,
              })}\n\n`
            );
          }
        }

        safeEnqueue("data: [DONE]\n\n");
        safeClose();
      } catch (err) {
        console.error("Agent error:", err);
        safeEnqueue(
          `data: ${JSON.stringify({
            type: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          })}\n\n`
        );
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders,
    },
  });
}
