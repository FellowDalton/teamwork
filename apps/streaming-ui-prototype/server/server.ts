/**
 * Streaming UI Prototype - Backend Server
 *
 * Bun HTTP server using Claude Agent SDK with MCP tools
 * for content retrieval. Streams NDJSON responses via SSE.
 */

import { z } from "zod";
import { searchContent, getPage, listPages, listBlockTypes } from "./content-store";

// ──────────────────────────────────────────────
// Dynamic SDK Import
// ──────────────────────────────────────────────

let query: any, tool: any, createSdkMcpServer: any;
let agentSdkAvailable = false;
type Options = import("@anthropic-ai/claude-agent-sdk").Options;

try {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  query = sdk.query;
  tool = sdk.tool;
  createSdkMcpServer = sdk.createSdkMcpServer;
  agentSdkAvailable = true;
  console.log("Claude Agent SDK loaded");
} catch (err) {
  console.warn("Claude Agent SDK not available:", err);
}

// ──────────────────────────────────────────────
// MCP Tools - Content Retrieval
// ──────────────────────────────────────────────

const contentMcpServer = agentSdkAvailable
  ? createSdkMcpServer({
      name: "content",
      tools: [
        tool(
          "search_content",
          "Search content blocks by query. Returns metrics, charts, activities, and project templates. Use this to find relevant data for the user's request.",
          {
            query: z.string().describe("Natural language search query"),
            blockType: z.string().optional().describe("Filter by block type: metric, chart, activity, project_template"),
            limit: z.number().optional().describe("Max results (default 20)"),
          },
          async ({ query: q, blockType, limit }: { query: string; blockType?: string; limit?: number }) => {
            const results = searchContent(q, blockType, limit);
            return {
              content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
            };
          }
        ),

        tool(
          "get_page",
          "Get a pre-composed page template with all its content blocks. Available pages: sales-dashboard, engineering-dashboard, product-overview",
          {
            slug: z.string().describe("Page slug (e.g. 'sales-dashboard')"),
          },
          async ({ slug }: { slug: string }) => {
            const result = getPage(slug);
            if (!result) {
              return {
                content: [{ type: "text" as const, text: `Page "${slug}" not found. Available: ${listPages().map(p => p.slug).join(', ')}` }],
                isError: true,
              };
            }
            return {
              content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
            };
          }
        ),

        tool(
          "list_pages",
          "List all available pre-composed page templates",
          {},
          async () => {
            const pages = listPages();
            return {
              content: [{ type: "text" as const, text: JSON.stringify(pages, null, 2) }],
            };
          }
        ),

        tool(
          "list_content_types",
          "List available content block types (metric, chart, activity, project_template, etc.)",
          {},
          async () => {
            const types = listBlockTypes();
            return {
              content: [{ type: "text" as const, text: JSON.stringify(types, null, 2) }],
            };
          }
        ),
      ],
    })
  : null;

// ──────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a UI builder agent. Users describe what they want to see, and you build it by:
1. Using your tools to search and retrieve relevant content from the content store
2. Deciding which UI format best fits their request
3. Outputting NDJSON lines that the frontend streaming framework will render

## CRITICAL OUTPUT RULES

Your response must ONLY contain NDJSON lines. Each line is a valid JSON object with a "type" field.
Do NOT include any explanatory text, markdown, or commentary. ONLY JSON lines, one per line.

## Available UI Plugins

### Dashboard Plugin
For metrics, charts, and activity feeds. Use when the user wants to see data, stats, or an overview.

Line types:
- {"type": "dashboard_meta", "title": "...", "description": "..."}
- {"type": "dashboard_metric", "label": "...", "value": "...", "change": "...", "trend": "up|down|neutral"}
- {"type": "dashboard_chart", "title": "...", "chartType": "bar", "data": [{"label": "...", "value": N}, ...]}
- {"type": "dashboard_activity", "user": "...", "action": "...", "timestamp": "..."}
- {"type": "dashboard_complete"}

### Project Plugin
For project plans, task breakdowns, and work organization. Use when the user wants to plan, create, or organize work.

Line types:
- {"type": "project", "name": "...", "description": "..."}
- {"type": "tasklist", "id": "tl-N", "name": "...", "description": "..."}
- {"type": "task", "id": "t-N", "tasklistId": "tl-N", "name": "...", "description": "...", "priority": "high|medium|low", "estimatedMinutes": N}
- {"type": "subtask", "taskId": "t-N", "name": "..."}
- {"type": "complete", "message": "..."}

## Instructions

1. ALWAYS use your tools first to find relevant content before outputting NDJSON
2. Choose the plugin that best matches the user's intent:
   - Questions about data/metrics/performance → Dashboard
   - Requests to plan/create/organize → Project
   - If both fit, output BOTH plugin types (multi-plugin streaming)
3. Transform retrieved content blocks into the correct NDJSON line format
4. For dashboard: start with dashboard_meta, then metrics, charts, activities, end with dashboard_complete
5. For projects: start with project header, then tasklists with their tasks and subtasks, end with complete
6. Use real data from the content store — don't make up numbers
7. Output one JSON object per line, no blank lines between them`;

// ──────────────────────────────────────────────
// CORS Headers
// ──────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ──────────────────────────────────────────────
// Request Handler
// ──────────────────────────────────────────────

async function handleStream(req: Request): Promise<Response> {
  if (!agentSdkAvailable || !contentMcpServer) {
    return new Response(JSON.stringify({ error: "Agent SDK not available" }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { message } = await req.json() as { message: string };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "Message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            closed = true;
          }
        }
      };

      const close = () => {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      };

      try {
        // Send init event
        send(`data: ${JSON.stringify({ type: "init", status: "streaming" })}\n\n`);

        const options: Options = {
          cwd: process.cwd(),
          model: "sonnet",
          systemPrompt: SYSTEM_PROMPT,
          maxTurns: 8,
          includePartialMessages: true,
          mcpServers: { content: contentMcpServer },
          disallowedTools: [
            "Bash", "Edit", "Write", "MultiEdit", "Read", "Glob", "Grep",
            "Task", "WebSearch", "WebFetch", "TodoWrite", "NotebookEdit",
          ],
          permissionMode: "bypassPermissions" as any,
          allowDangerouslySkipPermissions: true,
        };

        let fullText = "";

        for await (const event of query({ prompt: message, options })) {
          if (event.type === "stream_event") {
            const streamEvent = event.event;
            if (streamEvent.type === "content_block_delta") {
              const delta = (streamEvent as any).delta;
              if (delta?.type === "text_delta" && delta.text) {
                fullText += delta.text;

                // Forward raw text - the frontend NdjsonParser handles line splitting
                send(`data: ${JSON.stringify({ type: "text_delta", text: delta.text })}\n\n`);
              }
            }
          } else if (event.type === "result" && event.subtype === "success") {
            // Send the final complete text as NDJSON lines
            const resultText = event.result || fullText;
            if (resultText.trim()) {
              // Split into lines and send each as an NDJSON event
              const lines = resultText.trim().split("\n");
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                  send(`data: ${trimmed}\n\n`);
                }
              }
            }
          }
        }

        send("data: [DONE]\n\n");
      } catch (err) {
        send(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`);
        send("data: [DONE]\n\n");
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...corsHeaders,
    },
  });
}

// ──────────────────────────────────────────────
// Server
// ──────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3061");

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        status: "ok",
        agentSdk: agentSdkAvailable,
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Streaming endpoint
    if (url.pathname === "/api/stream" && req.method === "POST") {
      return handleStream(req);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Streaming UI server running on http://localhost:${PORT}`);
console.log(`Agent SDK: ${agentSdkAvailable ? "available" : "not available"}`);
