// lib/agents/agentic-status.ts
// Agentic Status Agent - Claude reasons about data fetching

import type { Options } from "@anthropic-ai/claude-agent-sdk";

export interface AgenticStatusContext {
  question: string;
  projectId?: number;
  projectName?: string;
}

export async function runAgenticStatusAgent(
  context: AgenticStatusContext,
  onThinking: ((text: string) => void) | undefined,
  onVisualization: ((spec: any) => void) | undefined,
  query: any,
  claudeCodePath: string | undefined,
  teamworkMcpServer: any
): Promise<{ text: string; visualizations: any[] }> {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a time tracking assistant with access to tools. Today is ${today}.

IMPORTANT: You must use the get_time_entries tool to fetch data. Reason about the user's question to determine the correct date range:
- "December" in past tense (logged, worked, etc.) means the most recent December
- "last 3 months" means the 3 months before today
- "Q4" means October-December of the most recent Q4
- If ambiguous, default to the interpretation that makes sense for time tracking data

After fetching data, provide:
1. A concise analysis (2-3 paragraphs) with insights
2. A JSON visualization block in this format:

\`\`\`visualization
[
  { "type": "summary", "title": "...", "metrics": [{ "label": "Total Hours", "value": "45.5h", "emphasis": true }] },
  { "type": "cards", "items": [...], "summary": { "totalHours": 45.5, "totalEntries": 12 } }
]
\`\`\`

VISUALIZATION TYPES:
- summary: For totals/aggregates. metrics array with label/value/emphasis
- cards: For activity lists. items array with id/date/taskName/projectName/hours/description
- chart: For trends. { "type": "chart", "chartType": "bar|line|pie", "title": "...", "data": [{ "label": "Dec", "value": 20 }] }
- custom: For creative SVGs. { "type": "custom", "svg": "<svg>...</svg>", "description": "..." }

Be conversational and helpful. If no data found, explain why and suggest alternatives.`;

  const options: Options = {
    cwd: process.cwd() + "/../..",
    model: "opus",
    systemPrompt,
    maxTurns: 5, // Allow tool calls
    includePartialMessages: true,
    env: process.env,
    permissionMode: "bypassPermissions", // Auto-approve tool usage
    ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
    mcpServers: [teamworkMcpServer], // Give access to get_time_entries tool
    stderr: (data: string) => console.log("Agentic Status STDERR:", data),
  };

  let fullText = "";
  let visualizations: any[] = [];

  const prompt = `${context.question}${context.projectId ? `\n\nProject context: ${context.projectName || `Project #${context.projectId}`} (ID: ${context.projectId})` : ""}`;

  console.log("=== AGENTIC STATUS AGENT ===");
  console.log("Question:", context.question);
  console.log("Project:", context.projectId);

  try {
    for await (const event of query({ prompt, options })) {
      if (event.type === "stream_event") {
        const streamEvent = event.event;
        if (streamEvent.type === "content_block_delta") {
          const delta = (streamEvent as any).delta;
          if (delta?.type === "text_delta" && delta.text) {
            fullText += delta.text;
            if (onThinking) onThinking(delta.text);
          }
        }
      } else if (event.type === "result" && event.subtype === "success") {
        if (!fullText && event.result) {
          fullText = event.result;
        }
      }
    }

    // Extract visualization JSON from response
    const vizMatch = fullText.match(/```visualization\s*([\s\S]*?)```/);
    if (vizMatch) {
      try {
        visualizations = JSON.parse(vizMatch[1].trim());
        // Remove the visualization block from text
        fullText = fullText.replace(/```visualization[\s\S]*?```/, "").trim();
      } catch (e) {
        console.error("Failed to parse visualization JSON:", e);
      }
    }

    // Also try to find JSON arrays not in code blocks (fallback)
    if (visualizations.length === 0) {
      const jsonMatch = fullText.match(/\[\s*\{[\s\S]*"type"\s*:\s*"(summary|cards|chart|custom)"[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          visualizations = JSON.parse(jsonMatch[0]);
          fullText = fullText.replace(jsonMatch[0], "").trim();
        } catch (e) {
          console.error("Failed to parse inline visualization JSON:", e);
        }
      }
    }

    console.log("Agentic agent completed. Text length:", fullText.length);
    console.log("Visualizations found:", visualizations.length);

  } catch (err) {
    console.error("Agentic status agent error:", err);
    fullText = "Sorry, I encountered an error while fetching data.";
  }

  return { text: fullText, visualizations };
}
