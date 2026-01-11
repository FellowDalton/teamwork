// lib/handlers/timelog.ts
// Timelog handler - time logging with AI assistance

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { corsHeaders, jsonResponse } from '../utils/response.ts';
import { validateAgentResponse } from '../utils/safety.ts';
import type { TeamworkClient } from "../teamwork_api_client/index.ts";

export interface TimelogChatBody {
  message: string;
  mode?: string;
  projectId?: number;
  projectName?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface TimelogChatDependencies {
  query: any;
  claudeCodePath: string | undefined;
  teamworkMcpServer: any;
  ALLOWED_PROJECTS: Array<{ id: number; name: string }>;
}

// Helper to extract timelog draft JSON from response
export function extractTimelogDraft(text: string): any | null {
  // Look for JSON block in markdown
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.action === "draft_timelog" && parsed.entries) {
        return parsed;
      }
    } catch {}
  }

  // Look for inline JSON with action: draft_timelog
  const inlineMatch = text.match(
    /\{[\s\S]*"action"\s*:\s*"draft_timelog"[\s\S]*\}/
  );
  if (inlineMatch) {
    try {
      return JSON.parse(inlineMatch[0]);
    } catch {}
  }

  return null;
}

export async function handleTimelogChat(
  body: TimelogChatBody,
  deps: TimelogChatDependencies
) {
  const { message, projectId, projectName, conversationHistory } = body;
  const { query, claudeCodePath, teamworkMcpServer, ALLOWED_PROJECTS } = deps;

  // Load the timelog agent prompt
  const promptPath = `${process.cwd()}/../../prompts/agents/timelog-agent.txt`;
  let systemPrompt: string;
  try {
    const promptFile = Bun.file(promptPath);
    systemPrompt = await promptFile.text();
  } catch {
    systemPrompt =
      "You are a time logging assistant for Teamwork.com. Help users log their billable hours.";
  }

  // Add context to the system prompt
  const contextAddition = `

## CURRENT CONTEXT
- Today's date: ${new Date().toISOString().split("T")[0]}
- Available projects: ${JSON.stringify(ALLOWED_PROJECTS)}
${
  projectId
    ? `- Selected project: ${projectName} (ID: ${projectId})`
    : "- No project selected - ask user which project to use"
}
`;

  systemPrompt += contextAddition;

  const options: Options = {
    cwd: process.cwd(),
    model: "opus",
    mcpServers: { teamwork: teamworkMcpServer },
    disallowedTools: [
      "Bash",
      "Edit",
      "Write",
      "MultiEdit",
      "Read",
      "Glob",
      "Grep",
      "Task",
      "WebSearch",
      "WebFetch",
      "TodoWrite",
      "NotebookEdit",
    ],
    systemPrompt,
    includePartialMessages: true,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 8,
    env: process.env,
    ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
    stderr: (data: string) => console.log("Timelog Agent STDERR:", data),
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let fullText = "";

      const safeEnqueue = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
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
        console.log("=== TIMELOG AGENT ===");
        console.log("Message:", message.slice(0, 100));
        console.log("Project:", projectId, projectName);
        console.log("Conversation history:", conversationHistory?.length || 0, "messages");

        // Build prompt with conversation history for context
        let fullPrompt = message;
        if (conversationHistory && conversationHistory.length > 0) {
          const historyContext = conversationHistory
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n\n");
          fullPrompt = `## Previous Conversation:\n${historyContext}\n\n## Current Request:\n${message}`;
        }

        safeEnqueue(
          `data: ${JSON.stringify({
            type: "init",
            model: "timelog-agent",
            info: "Processing your time logging request...",
          })}\n\n`
        );

        for await (const event of query({ prompt: fullPrompt, options })) {
          if (event.type === "stream_event") {
            const streamEvent = event.event;
            if (streamEvent.type === "content_block_delta") {
              const delta = (streamEvent as any).delta;
              if (delta?.type === "text_delta" && delta.text) {
                fullText += delta.text;
                // Stream thinking status but filter out JSON data
                const chunk = delta.text;
                // Skip chunks that look like JSON or code blocks
                const isJson =
                  chunk.includes("{") ||
                  chunk.includes("}") ||
                  chunk.includes("```") ||
                  chunk.includes('"action"') ||
                  chunk.includes('"entries"') ||
                  chunk.includes('"taskId"');
                if (!isJson && chunk.trim().length > 0) {
                  safeEnqueue(
                    `data: ${JSON.stringify({
                      type: "thinking",
                      thinking: chunk,
                    })}\n\n`
                  );
                }
              }
            }
          } else if (event.type === "result" && event.subtype === "success") {
            fullText = event.result || fullText;
          }
        }

        console.log("Timelog agent response length:", fullText.length);

        // SAFETY VALIDATION: Check agent response for any unsafe patterns
        const validation = validateAgentResponse(fullText);
        if (!validation.safe) {
          console.error(
            "SAFETY: Blocked unsafe agent response:",
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

        // Check if response contains a timelog draft
        const draft = extractTimelogDraft(fullText);

        if (draft && draft.entries && draft.entries.length > 0) {
          console.log(
            "Found timelog draft with",
            draft.entries.length,
            "entries"
          );

          // Send the draft entries to the frontend
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "timelog_draft",
              draft: {
                entries: draft.entries.map((e: any, idx: number) => ({
                  id: `draft-${idx}-${Date.now()}`,
                  taskId: e.taskId,
                  taskName: e.taskName,
                  projectId: e.projectId || projectId,
                  projectName: e.projectName || projectName,
                  hours: e.hours,
                  date: e.date,
                  comment: e.comment,
                  confidence: e.confidence || 0.8,
                  isBillable: true,
                })),
                summary: draft.summary || {
                  totalHours: draft.entries.reduce(
                    (sum: number, e: any) => sum + e.hours,
                    0
                  ),
                  totalEntries: draft.entries.length,
                  dateRange: draft.entries.map((e: any) => e.date).join(", "),
                },
                message:
                  draft.message ||
                  "Review the entries below and click Submit to log your time.",
              },
            })}\n\n`
          );

          // Send a clean text message without the JSON
          const cleanMessage =
            draft.message ||
            "I've prepared your time entries. Review them in the panel and adjust if needed, then confirm to submit.";
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "result",
              text: cleanMessage,
              final: true,
            })}\n\n`
          );
        } else {
          // No draft found - send the full text response
          // Remove any partial JSON that might have appeared
          const cleanText =
            fullText.replace(/```json[\s\S]*?```/g, "").trim() || fullText;
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "result",
              text: cleanText,
              final: true,
            })}\n\n`
          );
        }

        safeEnqueue("data: [DONE]\n\n");
        safeClose();
      } catch (err) {
        console.error("Timelog agent error:", err);
        safeEnqueue(
          `data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`
        );
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      ...corsHeaders,
    },
  });
}

// Submit timelog entries (called when user confirms draft)
export async function handleTimelogSubmit(
  body: {
    entries: Array<{
      taskId: number;
      hours: number;
      date: string;
      comment: string;
    }>;
  },
  teamwork: TeamworkClient
) {
  const { entries } = body;

  if (!entries || entries.length === 0) {
    return jsonResponse({ error: "No entries to submit" }, 400);
  }

  const results: Array<{ success: boolean; taskId: number; error?: string }> =
    [];

  for (const entry of entries) {
    try {
      const minutes = Math.round(entry.hours * 60);
      await teamwork.timeEntries.create(entry.taskId, {
        description: entry.comment,
        minutes,
        date: entry.date,
        isBillable: true,
      });
      results.push({ success: true, taskId: entry.taskId });
    } catch (err) {
      results.push({
        success: false,
        taskId: entry.taskId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  return jsonResponse({
    success: successCount === entries.length,
    submitted: successCount,
    total: entries.length,
    totalHours,
    results,
    message:
      successCount === entries.length
        ? `Successfully logged ${totalHours.toFixed(
            1
          )} hours across ${successCount} entries.`
        : `Logged ${successCount} of ${entries.length} entries. Some entries failed.`,
  });
}
