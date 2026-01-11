// lib/utils/date-parsing.ts
// Date range parsing from natural language

import type { Options } from "@anthropic-ai/claude-agent-sdk";

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

// Fast regex-based date parsing for common patterns
export function parseDateRangeFast(question: string): DateRange | null {
  const today = new Date();
  const q = question.toLowerCase();

  let startDate = new Date(today);
  let endDate = new Date(today);
  let label = "";

  // Parse "last N months"
  const monthMatch = q.match(/last\s+(\d+)\s+months?/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1]);
    startDate.setMonth(today.getMonth() - months);
    label = `Last ${months} month${months > 1 ? "s" : ""}`;
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label };
  }

  // Parse "last N weeks"
  const weekMatch = q.match(/last\s+(\d+)\s+weeks?/);
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1]);
    startDate.setDate(today.getDate() - weeks * 7);
    label = `Last ${weeks} week${weeks > 1 ? "s" : ""}`;
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label };
  }

  // Parse "last N days"
  const dayMatch = q.match(/last\s+(\d+)\s+days?/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1]);
    startDate.setDate(today.getDate() - days);
    label = `Last ${days} day${days > 1 ? "s" : ""}`;
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label };
  }

  // This week
  if (q.includes("this week")) {
    const dayOfWeek = today.getDay();
    startDate.setDate(today.getDate() - dayOfWeek);
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label: "This week" };
  }

  // This month
  if (q.includes("this month")) {
    startDate.setDate(1);
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label: "This month" };
  }

  // Last week
  if (q.includes("last week")) {
    const dayOfWeek = today.getDay();
    startDate.setDate(today.getDate() - dayOfWeek - 7);
    endDate.setDate(today.getDate() - dayOfWeek - 1);
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label: "Last week" };
  }

  // Today
  if (q.includes("today")) {
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label: "Today" };
  }

  // Yesterday
  if (q.includes("yesterday")) {
    startDate.setDate(today.getDate() - 1);
    endDate.setDate(today.getDate() - 1);
    return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label: "Yesterday" };
  }

  // Month names with smart year handling (December in January = last December)
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthMatch2 = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
  if (monthMatch2) {
    const monthIndex = monthNames.indexOf(monthMatch2[1]);
    if (monthIndex >= 0) {
      let year = today.getFullYear();
      // If the month is in the future, use previous year
      if (monthIndex > today.getMonth()) {
        year -= 1;
      }
      startDate = new Date(year, monthIndex, 1);
      endDate = new Date(year, monthIndex + 1, 0);
      label = `${monthNames[monthIndex].charAt(0).toUpperCase() + monthNames[monthIndex].slice(1)} ${year}`;
      return { startDate: startDate.toISOString().split("T")[0], endDate: endDate.toISOString().split("T")[0], label };
    }
  }

  // No pattern matched - return null to trigger LLM parsing
  return null;
}

// LLM-based flexible date parsing for complex queries
export async function parseDateRangeWithLLM(
  question: string,
  query: any,
  claudeCodePath: string | undefined,
  agentSdkAvailable: boolean
): Promise<DateRange> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  if (!agentSdkAvailable) {
    // Fallback to last 30 days if LLM not available
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: todayStr,
      label: "Last 30 days",
    };
  }

  const prompt = `Today is ${todayStr}. Extract the date range from this question about time tracking.

Question: "${question}"

Respond with ONLY a JSON object (no markdown, no explanation):
{"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "label": "Human readable label"}

Examples:
- "hours in Q4" → {"startDate": "2025-10-01", "endDate": "2025-12-31", "label": "Q4 2025"}
- "from October to December" → {"startDate": "2025-10-01", "endDate": "2025-12-31", "label": "October - December 2025"}
- "first half of the year" → {"startDate": "2025-01-01", "endDate": "2025-06-30", "label": "First half of 2025"}
- "since November" → {"startDate": "2025-11-01", "endDate": "${todayStr}", "label": "Since November"}

If no time reference, use last 30 days.`;

  const options: Options = {
    cwd: process.cwd(),
    model: "haiku",
    maxTurns: 1,
    disallowedTools: ["Bash", "Edit", "Write", "MultiEdit", "Read", "Glob", "Grep", "Task", "WebSearch", "WebFetch", "TodoWrite", "NotebookEdit"],
    systemPrompt: "You extract date ranges from natural language. Respond ONLY with JSON, no other text.",
    env: process.env,
    ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
  };

  try {
    let resultText = "";
    for await (const event of query({ prompt, options })) {
      if (event.type === "result" && event.subtype === "success") {
        resultText = event.result || "";
      }
    }

    // Parse the JSON response
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.startDate && parsed.endDate && parsed.label) {
        console.log("LLM parsed date range:", parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.error("LLM date parsing error:", err);
  }

  // Fallback to last 30 days
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 30);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: todayStr,
    label: "Last 30 days",
  };
}

// Main date parsing function - tries fast regex first, falls back to LLM
export async function parseDateRange(
  question: string,
  query: any,
  claudeCodePath: string | undefined,
  agentSdkAvailable: boolean
): Promise<DateRange> {
  // Try fast regex parsing first
  const fastResult = parseDateRangeFast(question);
  if (fastResult) {
    console.log("Fast date parse:", fastResult);
    return fastResult;
  }

  // Fall back to LLM for complex queries
  console.log("Using LLM for date parsing:", question);
  return parseDateRangeWithLLM(question, query, claudeCodePath, agentSdkAvailable);
}
