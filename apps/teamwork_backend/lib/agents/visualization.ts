// lib/agents/visualization.ts
// Visualization Agent - Decides how to display data

import type { Options } from "@anthropic-ai/claude-agent-sdk";

export interface VisualizationContext {
  question: string;
  data: any;
  periodLabel: string;
}

export async function runVisualizationAgent(
  context: VisualizationContext,
  query: any,
  claudeCodePath: string | undefined
): Promise<any | null> {
  const vizSystemPrompt = `You are a visualization expert. Given a question and time tracking data, output the BEST visualization(s) to answer it.

You can output MULTIPLE visualizations if appropriate. Output a JSON array of visualizations.

VISUALIZATION TYPES:

1. Summary (for totals/aggregates):
{ "type": "summary", "title": "...", "metrics": [{ "label": "Total Hours", "value": "278.5h", "emphasis": true }] }

2. Cards (for activity lists/"what did I work on"):
{ "type": "cards", "title": "...", "items": [{ "id": "1", "date": "2024-12-06", "taskName": "...", "projectName": "...", "hours": 2.5 }], "summary": { "totalHours": 45.5, "totalEntries": 12, "totalTasks": 5 } }

3. Bar Chart (for breakdowns/comparisons):
{ "type": "chart", "chartType": "bar", "title": "Hours by Month", "data": [{ "label": "Dec", "value": 20.5 }], "summary": { "total": 45.5, "average": 5.6 } }

4. Line Chart (for trends over time):
{ "type": "chart", "chartType": "line", "title": "Hours Trend", "data": [{ "label": "Week 1", "value": 20.5 }], "summary": { "total": 45.5 } }

5. Pie/Donut Chart (for proportions/distributions):
{ "type": "chart", "chartType": "pie", "title": "Hours by Project", "data": [{ "label": "Project A", "value": 20.5 }], "summary": { "total": 45.5 } }

6. Custom SVG (for ANY custom visualization the user requests):
{ "type": "custom", "title": "My Custom Viz", "svg": "<svg viewBox='0 0 200 100'>...</svg>", "description": "Brief description" }
Use this when the user asks for something creative or not covered by other types. Generate valid SVG with these colors:
- Primary: #06b6d4 (cyan)
- Secondary: #22d3ee, #14b8a6
- Text: #e4e4e7
- Background: transparent
Keep SVG simple and clean. Use viewBox for responsiveness.

DECISION GUIDE:
- "how many hours" → summary + chart breakdown
- "what did I work on" → cards (recent items) + summary
- "breakdown by month/week/project" → chart + summary
- "show activity" → cards + summary
- "trend" or "over time" → line chart
- Creative/unique requests (gauge, radial, progress, heatmap, infographic, custom) → use type "custom" with generated SVG

IMPORTANT: When the user asks for something creative, unique, or not a standard bar/line/pie chart,
use type "custom" and generate an SVG visualization. Be creative with the SVG!

OUTPUT FORMAT: Return a JSON array like: [{ visualization1 }, { visualization2 }]
Only output valid JSON, no markdown or explanation.`;

  const options: Options = {
    cwd: process.cwd() + "/../..",
    model: "default", // Uses Claude default model (Sonnet) - OAuth requires short names
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
    systemPrompt: vizSystemPrompt,
    maxTurns: 1,
    env: process.env, // Use current environment with API key
    ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }), // Use installed CLI
  };

  try {
    let resultText = "";

    const prompt = `Question: "${context.question}"
Period: ${context.periodLabel}

Time Data:
${JSON.stringify(context.data, null, 2)}

Output visualization JSON array:`;

    for await (const event of query({ prompt, options })) {
      if (event.type === "result" && event.subtype === "success") {
        resultText = event.result || "";
      }
    }

    // Parse JSON array or object from result
    const arrayMatch = resultText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    const objMatch = resultText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return [JSON.parse(objMatch[0])]; // Wrap single object in array
    }
    return null;
  } catch (err) {
    console.error("Visualization agent error:", err);
    return null;
  }
}
