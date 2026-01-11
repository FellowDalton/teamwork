// lib/agents/chat.ts
// Chat Agent - Provides conversational response

import type { Options } from "@anthropic-ai/claude-agent-sdk";

export interface ChatContext {
  question: string;
  data: any;
  periodLabel: string;
  projectName?: string;
}

export async function runChatAgent(
  context: ChatContext,
  onChunk: (text: string) => void,
  onThinking: ((text: string) => void) | undefined,
  query: any,
  claudeCodePath: string | undefined
): Promise<string> {
  const chatSystemPrompt = `You are a helpful time tracking assistant. The user asked a question and data has already been fetched.

Analyze the data and provide a helpful, concise response. Be conversational but informative.
Include key insights like:
- Total hours worked
- Busiest periods
- Notable tasks or projects
- Patterns or observations

Keep responses concise (2-4 paragraphs max). Data is being visualized separately, so focus on insights, not listing every entry.`;

  const options: Options = {
    cwd: process.cwd() + "/../..",
    model: "opus", // OAuth requires short names (opus/haiku/default)
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
    systemPrompt: chatSystemPrompt,
    maxTurns: 1,
    includePartialMessages: true,
    env: process.env, // Use current environment with API key
    ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }), // Use installed CLI (works with OAuth)
    stderr: (data: string) => console.log("Chat Agent STDERR:", data),
  };

  let fullText = "";

  console.log("Chat Agent starting with model:", options.model);
  console.log(
    "ANTHROPIC_API_KEY in process.env:",
    !!process.env.ANTHROPIC_API_KEY
  );
  console.log(
    "ANTHROPIC_API_KEY in options.env:",
    !!(options.env as any)?.ANTHROPIC_API_KEY
  );
  console.log(
    "CLAUDE_CODE_OAUTH_TOKEN set:",
    !!process.env.CLAUDE_CODE_OAUTH_TOKEN
  );

  const prompt = `User question: "${context.question}"
Period: ${context.periodLabel}
${context.projectName ? `Project: ${context.projectName}` : "All projects"}

Time Data Summary:
- Total Hours: ${context.data.totalHours}
- Total Entries: ${context.data.entryCount}
- Total Tasks: ${context.data.taskCount}
- Period: ${context.data.period.startDate} to ${context.data.period.endDate}

Sample entries (first 20):
${JSON.stringify(context.data.entries.slice(0, 20), null, 2)}

Provide a helpful analysis:`;

  try {
    for await (const event of query({ prompt, options })) {
      if (event.type === "stream_event") {
        const streamEvent = event.event;
        if (streamEvent.type === "content_block_delta") {
          const delta = (streamEvent as any).delta;
          if (delta?.type === "text_delta" && delta.text) {
            fullText += delta.text;
            onChunk(delta.text);
            // Also send as thinking for accumulated display
            if (onThinking) {
              onThinking(delta.text);
            }
          }
        }
      } else if (event.type === "result" && event.subtype === "success") {
        if (!fullText && event.result) {
          fullText = event.result;
          onChunk(event.result);
        }
      }
    }
  } catch (err) {
    console.error("Chat agent error:", err);
    fullText = "Sorry, I encountered an error analyzing the data.";
  }

  return fullText;
}
