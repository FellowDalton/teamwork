/**
 * Backend server for Teamwork Frontend - Agent SDK Version
 *
 * Architecture: Data-first parallel agents
 * 1. Parse user question to understand data needs
 * 2. Fetch data directly from Teamwork API
 * 3. Run Chat Agent and Viz Agent IN PARALLEL with same data
 * 4. Stream both responses to frontend
 */

// CRITICAL: Load environment FIRST before any SDK imports
// SDK reads CLAUDE_CODE_OAUTH_TOKEN on import to determine auth method
const rootEnvPath = "../../.env";
const envFile = Bun.file(rootEnvPath);
if (await envFile.exists()) {
  const envContent = await envFile.text();
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1);
        process.env[key] = value;
      }
    }
  }
}

// Auth priority: API key first (production), OAuth token second (local dev)
// This ensures deployed servers use the reliable API key
if (process.env.ANTHROPIC_API_KEY) {
  console.log("Using Anthropic API key (production mode)");
  // Clear OAuth token so SDK uses API key
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
} else if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  console.log("Using OAuth token for Claude Max subscription (local dev mode)");
} else {
  console.log("No Claude credentials found - AI features will be disabled");
}

// Dynamic imports AFTER env is loaded
// Make Agent SDK optional - server can still serve basic endpoints without Claude
let query: any, tool: any, createSdkMcpServer: any;
let agentSdkAvailable = false;
type Options = import("@anthropic-ai/claude-agent-sdk").Options;

try {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  query = sdk.query;
  tool = sdk.tool;
  createSdkMcpServer = sdk.createSdkMcpServer;
  agentSdkAvailable = true;
  console.log("Claude Agent SDK loaded successfully");
} catch (err) {
  console.warn("Claude Agent SDK not available - AI features disabled:", err);
  console.warn("Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN to enable AI");
}

// Get Claude Code executable path - checks env var, then common locations
function getClaudeCodePath(): string | undefined {
  // Environment variable takes priority
  if (process.env.CLAUDE_CODE_PATH) {
    console.log(`Using CLAUDE_CODE_PATH: ${process.env.CLAUDE_CODE_PATH}`);
    return process.env.CLAUDE_CODE_PATH;
  }

  // Common locations to check (in order of priority)
  const { existsSync } = require("fs");
  const possiblePaths = [
    // Local dev (nvm) - prefer system CLI for local development
    `${process.env.HOME}/.nvm/versions/node/v20.19.5/bin/claude`,
    // User-local installs
    `${process.env.HOME}/.local/bin/claude`,
    // Global npm install
    "/usr/local/bin/claude",
    "/usr/bin/claude",
    // Railway/Docker container - installed via npm dependency (fallback for production)
    "/app/node_modules/.bin/claude",
    "./node_modules/.bin/claude",
  ];

  for (const p of possiblePaths) {
    try {
      if (existsSync(p)) {
        console.log(`Found Claude Code at: ${p}`);
        return p;
      }
    } catch {
      // Skip paths that can't be checked
    }
  }

  // Let SDK try to find it in PATH
  console.log("Claude Code path not found in common locations - SDK will try PATH");
  return undefined;
}

const claudeCodePath = getClaudeCodePath();

const { createTeamworkClient } = await import(
  "./teamwork_api_client/index.ts"
);
const { z } = await import("zod");

// ============================================================================
// PROJECT AGENT CONFIGURATION - Maps project IDs to working directories
// ============================================================================

interface ProjectAgentConfig {
  projectId: number;
  projectName: string;
  cwd: string;
  model?: string;
  enabled: boolean;
}

const PROJECT_AGENT_CONFIGS: ProjectAgentConfig[] = [
  {
    projectId: 806824,
    projectName: "EXHAUSTO - AI Development",
    cwd: "/Users/dalton/projects/exhausto-website-2026",
    model: "claude-sonnet-4-20250514",
    enabled: true,
  },
  // Add more projects here as needed
];

function getProjectAgentConfig(projectId: number | undefined): ProjectAgentConfig | null {
  if (!projectId) return null;
  return PROJECT_AGENT_CONFIGS.find(c => c.projectId === projectId && c.enabled) || null;
}

// ============================================================================
// DATE PARSING - Extract date ranges from natural language
// ============================================================================

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

function parseDateRange(question: string): DateRange {
  const today = new Date();
  const q = question.toLowerCase();

  // Default to last 30 days
  let startDate = new Date(today);
  let endDate = new Date(today);
  let label = "Last 30 days";

  // Parse months
  const monthMatch = q.match(/last\s+(\d+)\s+months?/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1]);
    startDate.setMonth(today.getMonth() - months);
    label = `Last ${months} month${months > 1 ? "s" : ""}`;
  }
  // Parse weeks
  else if (q.match(/last\s+(\d+)\s+weeks?/)) {
    const weeks = parseInt(q.match(/last\s+(\d+)\s+weeks?/)![1]);
    startDate.setDate(today.getDate() - weeks * 7);
    label = `Last ${weeks} week${weeks > 1 ? "s" : ""}`;
  }
  // Parse days
  else if (q.match(/last\s+(\d+)\s+days?/)) {
    const days = parseInt(q.match(/last\s+(\d+)\s+days?/)![1]);
    startDate.setDate(today.getDate() - days);
    label = `Last ${days} day${days > 1 ? "s" : ""}`;
  }
  // This week
  else if (q.includes("this week")) {
    const dayOfWeek = today.getDay();
    startDate.setDate(today.getDate() - dayOfWeek);
    label = "This week";
  }
  // This month
  else if (q.includes("this month")) {
    startDate.setDate(1);
    label = "This month";
  }
  // Last week
  else if (q.includes("last week")) {
    const dayOfWeek = today.getDay();
    startDate.setDate(today.getDate() - dayOfWeek - 7);
    endDate.setDate(today.getDate() - dayOfWeek - 1);
    label = "Last week";
  }
  // Today
  else if (q.includes("today")) {
    label = "Today";
  }
  // Yesterday
  else if (q.includes("yesterday")) {
    startDate.setDate(today.getDate() - 1);
    endDate.setDate(today.getDate() - 1);
    label = "Yesterday";
  }
  // December, January, etc.
  else if (
    q.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/
    )
  ) {
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const monthIndex = monthNames.findIndex((m) => q.includes(m));
    if (monthIndex >= 0) {
      startDate = new Date(today.getFullYear(), monthIndex, 1);
      endDate = new Date(today.getFullYear(), monthIndex + 1, 0);
      label =
        monthNames[monthIndex].charAt(0).toUpperCase() +
        monthNames[monthIndex].slice(1);
    }
  }
  // Default: last 30 days
  else {
    startDate.setDate(today.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    label,
  };
}

// ============================================================================
// VISUALIZATION AGENT - Decides how to display data (runs in parallel with chat)
// ============================================================================

async function runVisualizationAgent(context: {
  question: string;
  data: any;
  periodLabel: string;
}): Promise<any | null> {
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

// ============================================================================
// CHAT AGENT - Provides conversational response (runs in parallel with viz)
// ============================================================================

async function runChatAgent(
  context: {
    question: string;
    data: any;
    periodLabel: string;
    projectName?: string;
  },
  onChunk: (text: string) => void,
  onThinking?: (text: string) => void
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

// Extract structured data from Main Agent's response
// Looks for JSON blocks or structured output in the response
function extractDataFromResponse(response: string): any | null {
  // Try to find JSON in the response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }

  // Try to find inline JSON object
  const inlineJson = response.match(/\{[\s\S]*"timeEntries"[\s\S]*\}/);
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson[0]);
    } catch {}
  }

  return null;
}

// Configuration (env already loaded at top of file)
const PORT = parseInt(process.env.PORT || "3051");
const TEAMWORK_API_URL = process.env.TEAMWORK_API_URL;
const TEAMWORK_BEARER_TOKEN = process.env.TEAMWORK_BEARER_TOKEN;
const DEFAULT_PROJECT_ID = parseInt(process.env.TEAMWORK_PROJECT_ID || "0");

// Allowed project IDs
const ALLOWED_PROJECTS = [
  { id: 805682, name: "AI workflow test" },
  { id: 804926, name: "KiroViden - Klyngeplatform" },
];

// Initialize Teamwork client
if (!TEAMWORK_API_URL || !TEAMWORK_BEARER_TOKEN) {
  console.error(
    "Missing required environment variables: TEAMWORK_API_URL, TEAMWORK_BEARER_TOKEN"
  );
  process.exit(1);
}

const teamwork = createTeamworkClient({
  apiUrl: TEAMWORK_API_URL,
  bearerToken: TEAMWORK_BEARER_TOKEN,
});

// ============================================================================
// SAFETY ARCHITECTURE: Read-Only MCP Tools
// ============================================================================
//
// CRITICAL: This MCP server contains ONLY read-only tools. Write operations
// (creating time entries, projects, tasks) are intentionally EXCLUDED.
//
// Why: To prevent the AI from making changes to Teamwork without user review.
//
// How it works:
// 1. Chat agents can ONLY use read tools (get_time_entries, search_tasks, etc.)
// 2. Agents output draft JSON (timelog_draft, project_draft) for user review
// 3. Users review drafts in the UI and click Submit/Create
// 4. Separate submit endpoints (/api/agent/timelog/submit, /api/agent/project/submit)
//    handle the actual write operations
//
// BLOCKED OPERATIONS (not available to chat agents):
// - log_time - Use /api/agent/timelog/submit instead
// - create_project - Use /api/agent/project/submit instead
// - create_task - Use /api/agent/task/submit instead
// - update_task - Use /api/agent/task/update instead
//
// ============================================================================

// List of blocked tool names (for validation/logging)
const BLOCKED_WRITE_TOOLS = [
  "log_time",
  "create_project",
  "create_task",
  "update_task",
  "delete_task",
  "create_timelog",
];

// Validation helper to detect if agent is trying to use blocked operations
function validateAgentResponse(response: string): {
  safe: boolean;
  warning?: string;
} {
  // Check for any patterns that might indicate the agent is trying to bypass safety
  const dangerPatterns = [
    /teamwork\.timeEntries\.create/i,
    /teamwork\.projects\.create/i,
    /teamwork\.tasks\.create/i,
    /\.create\s*\(/i,
    /\.update\s*\(/i,
    /\.delete\s*\(/i,
  ];

  for (const pattern of dangerPatterns) {
    if (pattern.test(response)) {
      console.warn(
        "SAFETY WARNING: Agent response contains potential write operation:",
        pattern.source
      );
      return {
        safe: false,
        warning: `Blocked potential write operation matching: ${pattern.source}`,
      };
    }
  }

  return { safe: true };
}

// ============================================================================
// MCP SERVER: Teamwork Tools (READ-ONLY)
// These tools are called directly by Claude - no code writing needed
// ============================================================================

const teamworkMcpServer = createSdkMcpServer({
  name: "teamwork",
  tools: [
    // Simple test tool
    tool(
      "test_connection",
      "Test if the MCP server is working.",
      {},
      async () => {
        console.log("test_connection called!");
        return {
          content: [{ type: "text", text: "MCP server is working!" }],
        };
      }
    ),

    // Get time entries for a date range
    tool(
      "get_time_entries",
      "Fetch time entries for a date range. Returns total hours, entry count, and entry details.",
      {
        startDate: z.string(),
        endDate: z.string(),
        projectId: z.string().optional(),
      },
      async ({ startDate, endDate, projectId }) => {
        // Convert projectId to number if it's a string
        const numericProjectId = projectId ? Number(projectId) : undefined;
        console.log("get_time_entries called with:", {
          startDate,
          endDate,
          projectId: numericProjectId,
        });
        try {
          const person = await teamwork.people.me();
          const userId = person.id;
          console.log("User ID:", userId);

          const response = await teamwork.timeEntries.list({
            startDate,
            endDate,
            include: ["tasks", "projects"],
            orderBy: "date",
            orderMode: "desc",
            pageSize: 500,
            ...(numericProjectId ? { projectIds: [numericProjectId] } : {}),
          });

          // Filter to user's entries
          const myEntries = response.timelogs.filter(
            (t) => t.userId === userId
          );
          const totalMinutes = myEntries.reduce((sum, e) => sum + e.minutes, 0);
          const totalHours = totalMinutes / 60;
          const taskIds = new Set(
            myEntries.map((e) => e.taskId).filter(Boolean)
          );

          // Format entries for output
          const entries = myEntries.slice(0, 50).map((e) => ({
            id: e.id,
            date: e.date,
            hours: e.minutes / 60,
            taskId: e.taskId,
            taskName:
              response.included?.tasks?.[String(e.taskId)]?.name ||
              `Task #${e.taskId}`,
            projectName:
              response.included?.projects?.[String(e.projectId)]?.name ||
              `Project #${e.projectId}`,
            description: e.description || "",
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalHours: Math.round(totalHours * 100) / 100,
                    totalMinutes,
                    entryCount: myEntries.length,
                    taskCount: taskIds.size,
                    period: { startDate, endDate },
                    entries,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err) {
          console.error("get_time_entries error:", err);
          return {
            content: [
              { type: "text", text: `Error fetching time entries: ${err}` },
            ],
            isError: true,
          };
        }
      }
    ),

    // Get current user info
    tool(
      "get_current_user",
      "Get the currently authenticated user info (id, name, email).",
      {},
      async () => {
        try {
          const person = await teamwork.people.me();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    id: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName,
                    email: person.emailAddress,
                    fullName: `${person.firstName} ${person.lastName}`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error fetching user: ${err}` }],
            isError: true,
          };
        }
      }
    ),

    // Get projects list
    tool("get_projects", "Get list of available projects.", {}, async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(ALLOWED_PROJECTS, null, 2),
          },
        ],
      };
    }),

    // Get tasks for a project
    tool(
      "get_tasks_by_project",
      "Get all tasks for a specific project. Returns task id, name, description, and status.",
      {
        projectId: z.union([z.number(), z.string()]).describe("The project ID"),
      },
      async ({ projectId }) => {
        try {
          const numericProjectId = Number(projectId);
          console.log("get_tasks_by_project called with:", numericProjectId);

          const response = await teamwork.tasks.listByProject(
            numericProjectId,
            {
              include: ["tags"],
              pageSize: 100,
            }
          );

          const tasks = response.tasks.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description || "",
            status: t.status || "active",
            estimatedMinutes: t.estimatedMinutes || 0,
            tags: t.tags?.map((tag: any) => tag.name) || [],
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ tasks, count: tasks.length }, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error fetching tasks: ${err}` }],
            isError: true,
          };
        }
      }
    ),

    // Search tasks by description
    tool(
      "search_tasks",
      "Search for tasks matching a query string. Searches task names and descriptions.",
      {
        projectId: z
          .union([z.number(), z.string()])
          .describe("The project ID to search in"),
        query: z
          .string()
          .describe(
            "Search query to match against task names and descriptions"
          ),
      },
      async ({ projectId, query }) => {
        try {
          const numericProjectId = Number(projectId);
          console.log("search_tasks called with:", {
            projectId: numericProjectId,
            query,
          });

          const response = await teamwork.tasks.listByProject(
            numericProjectId,
            {
              include: ["tags"],
              pageSize: 100,
            }
          );

          const queryLower = query.toLowerCase();
          const queryTerms = queryLower.split(/\s+/);

          // Score and filter tasks by relevance
          const scoredTasks = response.tasks.map((t: any) => {
            const nameLower = (t.name || "").toLowerCase();
            const descLower = (t.description || "").toLowerCase();
            let score = 0;

            // Check each query term
            for (const term of queryTerms) {
              if (nameLower.includes(term)) score += 3;
              if (descLower.includes(term)) score += 1;
            }

            // Boost for exact phrase match
            if (nameLower.includes(queryLower)) score += 5;
            if (descLower.includes(queryLower)) score += 2;

            return { task: t, score };
          });

          // Filter to tasks with score > 0 and sort by score
          const matchingTasks = scoredTasks
            .filter((st: any) => st.score > 0)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 10)
            .map((st: any) => ({
              id: st.task.id,
              name: st.task.name,
              description: st.task.description || "",
              status: st.task.status || "active",
              estimatedMinutes: st.task.estimatedMinutes || 0,
              relevanceScore: st.score,
              tags: st.task.tags?.map((tag: any) => tag.name) || [],
            }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    query,
                    projectId: numericProjectId,
                    matchCount: matchingTasks.length,
                    tasks: matchingTasks,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error searching tasks: ${err}` }],
            isError: true,
          };
        }
      }
    ),

    // SAFETY: log_time tool REMOVED from chat agent MCP server
    // Write operations are only allowed via explicit submit endpoints:
    // - /api/agent/timelog/submit (for time entries)
    // - /api/agent/project/submit (for project creation)
    // This ensures users always review changes before they're applied.
  ],
});

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

// ============================================================================
// AGENT CHAT HANDLER - Data-first parallel architecture
// 1. Parse question to understand data needs
// 2. Fetch data directly from Teamwork
// 3. Run Chat Agent and Viz Agent IN PARALLEL
// 4. Stream both responses to frontend
// ============================================================================

async function handleAgentChat(body: {
  message: string;
  mode?: "status" | "timelog" | "project" | "general";
  projectId?: number;
  projectName?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}) {
  const { message, mode = "general", projectId, projectName, conversationHistory } = body;

  if (!message) {
    return new Response("Message is required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Route to specialized handlers based on mode
  if (mode === "timelog") {
    return handleTimelogChat({ ...body, conversationHistory });
  }

  if (mode === "project") {
    return handleProjectChat(body);
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
        console.log("=== PARALLEL AGENT FLOW ===");
        console.log("Mode:", mode, "| Message:", message.slice(0, 50));

        // STEP 1: Parse date range from question
        const dateRange = parseDateRange(message);
        console.log("Date range:", dateRange);

        safeEnqueue(
          `data: ${JSON.stringify({
            type: "init",
            model: "parallel-agents",
            info: `Fetching data for ${dateRange.label}...`,
          })}\n\n`
        );

        // STEP 2: Fetch data directly from Teamwork
        safeEnqueue(
          `data: ${JSON.stringify({
            type: "thinking",
            thinking: `Fetching time entries from ${dateRange.startDate} to ${dateRange.endDate}...`,
          })}\n\n`
        );

        let timeData: any;
        try {
          const person = await teamwork.people.me();
          const userId = person.id;

          const response = await teamwork.timeEntries.list({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            include: ["tasks", "projects"],
            orderBy: "date",
            orderMode: "desc",
            pageSize: 500,
            ...(projectId ? { projectIds: [projectId] } : {}),
          });

          // Filter to user's entries
          const myEntries = response.timelogs.filter(
            (t) => t.userId === userId
          );
          const totalMinutes = myEntries.reduce((sum, e) => sum + e.minutes, 0);
          const totalHours = totalMinutes / 60;
          const taskIds = new Set(
            myEntries.map((e) => e.taskId).filter(Boolean)
          );

          // Format entries
          const entries = myEntries.map((e) => ({
            id: e.id,
            date: e.date,
            hours: Math.round((e.minutes / 60) * 100) / 100,
            taskId: e.taskId,
            taskName:
              response.included?.tasks?.[String(e.taskId)]?.name ||
              `Task #${e.taskId}`,
            projectName:
              response.included?.projects?.[String(e.projectId)]?.name ||
              `Project #${e.projectId}`,
            description: e.description || "",
          }));

          timeData = {
            totalHours: Math.round(totalHours * 100) / 100,
            totalMinutes,
            entryCount: myEntries.length,
            taskCount: taskIds.size,
            period: {
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            },
            entries,
          };

          console.log(
            `Fetched ${myEntries.length} entries, ${totalHours.toFixed(
              1
            )}h total`
          );
        } catch (err) {
          console.error("Error fetching time data:", err);
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "error",
              error: "Failed to fetch time data from Teamwork",
            })}\n\n`
          );
          safeClose();
          return;
        }

        safeEnqueue(
          `data: ${JSON.stringify({
            type: "thinking",
            thinking: `Found ${timeData.entryCount} entries (${timeData.totalHours}h). Running analysis...`,
          })}\n\n`
        );

        // STEP 3: Run Chat Agent and Viz Agent IN PARALLEL
        const agentContext = {
          question: message,
          data: timeData,
          periodLabel: dateRange.label,
          projectName,
        };

        // Start both agents simultaneously
        const vizPromise = runVisualizationAgent(agentContext);
        const chatPromise = runChatAgent(
          agentContext,
          (chunk) => {
            // Don't send text chunks - we'll send the final result at the end
          },
          (thinking) => {
            // Stream thinking for accumulated display in UI
            safeEnqueue(
              `data: ${JSON.stringify({ type: "thinking", thinking })}\n\n`
            );
          }
        );

        // Wait for both to complete
        const [vizSpecs, chatResult] = await Promise.all([
          vizPromise,
          chatPromise,
        ]);

        console.log("Chat Agent completed:", chatResult?.length || 0, "chars");
        console.log(
          "Viz Agent returned:",
          vizSpecs ? `${vizSpecs.length} visualizations` : "null"
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

        // Send ALL visualizations from Viz Agent
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

// ============================================================================
// CHART REQUEST HANDLER - Generate specific chart visualizations
// ============================================================================

async function handleChartRequest(body: {
  chartType: string;
  projectId?: number;
}) {
  const { chartType: rawChartType, projectId } = body;

  if (!rawChartType) {
    return new Response("Chart type is required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Parse format: "grouping:vizType" (e.g., "hours-by-week:line")
  const [chartType, vizTypeOverride] = rawChartType.split(":");

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
        console.log("=== CHART REQUEST ===");
        console.log("Chart type:", chartType, "| Project:", projectId);

        // Get current user
        const person = await teamwork.people.me();
        const userId = person.id;

        // Fetch time data for the last 90 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const response = await teamwork.timeEntries.list({
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          include: ["tasks", "projects"],
          orderBy: "date",
          orderMode: "asc",
          pageSize: 500,
          ...(projectId ? { projectIds: [projectId] } : {}),
        });

        // Filter to user's entries (use timelogs, not timeEntries)
        const entries = (response.timelogs || []).filter(
          (t: any) => t.userId === userId
        );
        const included = response.included || {};
        console.log("Fetched", entries.length, "entries for chart");

        // Generate chart based on type
        let vizSpec: any = null;

        if (chartType === "hours-by-week") {
          // Group by week
          const weeklyData: Record<string, number> = {};
          for (const entry of entries) {
            const dateStr = entry.timeLogged || entry.date;
            if (!dateStr) continue;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) continue; // Skip invalid dates
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split("T")[0];
            weeklyData[weekKey] =
              (weeklyData[weekKey] || 0) + (entry.minutes || 0) / 60;
          }

          const sortedWeeks = Object.keys(weeklyData).sort();
          const total = Object.values(weeklyData).reduce((a, b) => a + b, 0);
          const count = Object.keys(weeklyData).length;
          vizSpec = {
            type: "chart",
            chartType: "line",
            title: "Hours by Week",
            data: sortedWeeks.map((week) => ({
              label: new Date(week).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              value: parseFloat(weeklyData[week].toFixed(1)),
            })),
            summary: {
              total: parseFloat(total.toFixed(1)),
              average: count > 0 ? parseFloat((total / count).toFixed(1)) : 0,
            },
          };
        } else if (chartType === "hours-by-month") {
          // Group by month
          const monthlyData: Record<string, number> = {};
          for (const entry of entries) {
            const dateStr = entry.timeLogged || entry.date;
            if (!dateStr) continue;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) continue;
            const monthKey = `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`;
            monthlyData[monthKey] =
              (monthlyData[monthKey] || 0) + (entry.minutes || 0) / 60;
          }

          const sortedMonths = Object.keys(monthlyData).sort();
          const totalM = Object.values(monthlyData).reduce((a, b) => a + b, 0);
          const countM = Object.keys(monthlyData).length;
          vizSpec = {
            type: "chart",
            chartType: "line",
            title: "Hours by Month",
            data: sortedMonths.map((month) => ({
              label: new Date(month + "-01").toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
              }),
              value: parseFloat(monthlyData[month].toFixed(1)),
            })),
            summary: {
              total: parseFloat(totalM.toFixed(1)),
              average:
                countM > 0 ? parseFloat((totalM / countM).toFixed(1)) : 0,
            },
          };
        } else if (chartType === "hours-by-task") {
          // Group by task - look up task name from included data
          const taskData: Record<string, number> = {};
          for (const entry of entries) {
            const taskName =
              included?.tasks?.[String(entry.taskId)]?.name ||
              entry.description ||
              `Task #${entry.taskId}` ||
              "No task";
            taskData[taskName] =
              (taskData[taskName] || 0) + (entry.minutes || 0) / 60;
          }

          const sortedTasks = Object.entries(taskData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

          const totalT = Object.values(taskData).reduce((a, b) => a + b, 0);
          const countT = Object.keys(taskData).length;
          vizSpec = {
            type: "chart",
            chartType: "bar",
            title: "Hours by Task (Top 10)",
            data: sortedTasks.map(([label, value]) => ({
              label,
              value: parseFloat(value.toFixed(1)),
            })),
            summary: {
              total: parseFloat(totalT.toFixed(1)),
              average:
                countT > 0 ? parseFloat((totalT / countT).toFixed(1)) : 0,
            },
          };
        } else if (chartType === "hours-by-project") {
          // Group by project - look up project name from included data
          const projectData: Record<string, number> = {};
          for (const entry of entries) {
            const projName =
              included?.projects?.[String(entry.projectId)]?.name ||
              `Project #${entry.projectId}` ||
              "No project";
            projectData[projName] =
              (projectData[projName] || 0) + (entry.minutes || 0) / 60;
          }

          const sortedProjects = Object.entries(projectData).sort(
            (a, b) => b[1] - a[1]
          );

          const totalP = Object.values(projectData).reduce((a, b) => a + b, 0);
          const countP = Object.keys(projectData).length;
          vizSpec = {
            type: "chart",
            chartType: "bar",
            title: "Hours by Project",
            data: sortedProjects.map(([label, value]) => ({
              label,
              value: parseFloat(value.toFixed(1)),
            })),
            summary: {
              total: parseFloat(totalP.toFixed(1)),
              average:
                countP > 0 ? parseFloat((totalP / countP).toFixed(1)) : 0,
            },
          };
        }

        if (vizSpec) {
          // Override chart type if specified (bar, line, card)
          if (
            vizTypeOverride &&
            ["bar", "line", "card"].includes(vizTypeOverride)
          ) {
            vizSpec.chartType = vizTypeOverride;
          }
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "visualization",
              spec: vizSpec,
            })}\n\n`
          );
        }

        safeEnqueue("data: [DONE]\n\n");
        safeClose();
      } catch (err) {
        console.error("Chart request error:", err);
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
      Connection: "keep-alive",
      ...corsHeaders,
    },
  });
}

// Helper to extract timelog draft JSON from response
function extractTimelogDraft(text: string): any | null {
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

// Project creation mode - helps users set up new projects with tasks and structure
async function handleProjectChat(body: {
  message: string;
  mode?: string;
  projectId?: number;
  projectName?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  projectDraft?: {
    project: { name: string; description?: string };
    tasklists: Array<{
      id: string;
      name: string;
      tasks: Array<{
        id: string;
        name: string;
        description?: string;
        startDate?: string;
        dueDate?: string;
        estimatedMinutes?: number;
        subtasks: Array<{ name: string }>;
      }>;
    }>;
    summary: { totalTasklists: number; totalTasks: number; totalSubtasks: number };
  };
}) {
  const { message, conversationHistory, projectDraft } = body;

  // System prompt for project creation assistant - uses JSON Lines streaming format
  const systemPrompt = `You are a project creation assistant for Teamwork.com. Your role is to help users set up new projects with well-organized task structures.

## CRITICAL SAFETY RULE

**YOU MUST NEVER DIRECTLY CREATE PROJECTS OR MODIFY DATA IN TEAMWORK.**

The frontend handles actual project creation after user clicks "Create Project". Your job is to OUTPUT a complete project structure in JSON Lines format.

## YOUR CAPABILITIES
- Help users define project scope and requirements
- Create organized task lists (phases, categories, or workstreams)
- Break down work into tasks and subtasks
- Suggest appropriate deadlines and priorities
- Apply relevant tags for organization

## INTERACTION FLOW
1. **Gather Requirements**: If the user's request is vague, ask clarifying questions. If they provide a PRD or detailed spec, proceed to build the structure.

2. **Process Attached Files**: If the user provides documents (PRDs, specs, requirements):
   - Extract project goals for the description
   - Identify phases/milestones for task lists
   - Break down requirements into tasks with clear deliverables
   - Identify sub-requirements as subtasks
   - Note any mentioned deadlines

3. **Output JSON Lines**: When ready, output the ENTIRE project structure as JSON Lines (one JSON object per line).

## CRITICAL: JSON LINES OUTPUT FORMAT

**THINK FIRST, THEN OUTPUT**: Plan the complete project structure in your head before outputting ANY JSON. This ensures holistic, consistent planning.

**FORMAT**: Each line must be a complete, valid JSON object. Output in this EXACT order:

1. Project metadata (FIRST) - include total budget hours:
{"type": "project", "name": "Project Name", "description": "Full project description", "budgetHours": 120}

2. All tasklists (phases/categories):
{"type": "tasklist", "id": "tl-1", "name": "Phase 1: Planning", "description": "Initial planning phase"}
{"type": "tasklist", "id": "tl-2", "name": "Phase 2: Design", "description": "Design work"}

3. Tasks grouped by tasklist - ALWAYS include estimatedMinutes:
{"type": "task", "id": "t-1", "tasklistId": "tl-1", "name": "Task name", "description": "Task details", "priority": "medium", "estimatedMinutes": 120}
{"type": "task", "id": "t-2", "tasklistId": "tl-1", "name": "Another task", "description": "More details", "priority": "high", "estimatedMinutes": 240}

4. Subtasks after their parent task - ALWAYS include estimatedMinutes:
{"type": "subtask", "taskId": "t-1", "name": "Subtask name", "description": "Subtask details", "estimatedMinutes": 60}
{"type": "subtask", "taskId": "t-1", "name": "Another subtask", "estimatedMinutes": 30}

5. Completion marker (LAST):
{"type": "complete"}

6. Summary message (AFTER JSON):
After the complete marker, write a brief summary including total hours and estimated budget. Example:
"I've created a project with 3 phases, 12 tasks, and 45 subtasks totaling 120 hours (~144,000 DKK at 1,200 DKK/hour). Would you like me to adjust anything?"

## RULES
- **IMPORTANT**: Think through the ENTIRE project structure before outputting any JSON
- **ALWAYS include estimatedMinutes** for every task and subtask (be realistic, not too short)
- **ALWAYS include budgetHours** in the project line (sum of all task/subtask hours)
- Each line must be valid JSON (no trailing commas, proper quotes)
- Use consistent ID schemes: tl-1, tl-2 for tasklists; t-1, t-2 for tasks
- priority: "none", "low", "medium", or "high"
- Dates: YYYY-MM-DD format (startDate, endDate optional)
- Every task that warrants breakdown should have subtasks
- Output JSON directly - no markdown code blocks, no prefixes

## TIME ESTIMATION GUIDELINES
- Minimum task: 30 minutes (30)
- Small task: 1-2 hours (60-120)
- Medium task: 2-4 hours (120-240)
- Large task: 4-8 hours (240-480)
- Subtasks are typically 15-60 minutes (15-60)
- Be realistic - software tasks often take longer than expected

## ID SCHEME
- Tasklists: tl-1, tl-2, tl-3, ...
- Tasks: t-1, t-2, t-3, ... (global across all tasklists)
- Subtasks: referenced by taskId (e.g., taskId: "t-1")

## CURRENT CONTEXT
- Today's date: ${new Date().toISOString().split("T")[0]}
${
  projectDraft
    ? `
## EXISTING PROJECT DRAFT
The user has already created a project draft that you should modify based on their request:

**Project:** ${projectDraft.project.name}
${projectDraft.project.description ? `**Description:** ${projectDraft.project.description}` : ""}

**Current Structure (${projectDraft.summary.totalTasklists} tasklists, ${projectDraft.summary.totalTasks} tasks, ${projectDraft.summary.totalSubtasks} subtasks):**
${projectDraft.tasklists
  .map(
    (tl) => `
### ${tl.name}
${tl.tasks
  .map(
    (t) =>
      `- ${t.name}${t.estimatedMinutes ? ` (${Math.round(t.estimatedMinutes / 60)}h)` : ""}${t.startDate || t.dueDate ? ` [${t.startDate || ""} → ${t.dueDate || ""}]` : ""}${t.subtasks.length > 0 ? `\n  Subtasks: ${t.subtasks.map((s) => s.name).join(", ")}` : ""}`
  )
  .join("\n")}`
  )
  .join("\n")}

When the user asks for changes, output the COMPLETE updated project structure in JSON Lines format (not just the changes).
`
    : ""
}

If the user provides a PRD or detailed requirements, analyze them and output the complete project structure. For vague requests, ask clarifying questions first.`;

  // Build the prompt with conversation history if available
  let fullPrompt = message;
  if (conversationHistory && conversationHistory.length > 0) {
    const historyContext = conversationHistory
      .slice(-10) // Keep last 10 messages for context
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    fullPrompt = `## Previous Conversation:\n${historyContext}\n\n## Current Request:\n${message}`;
  }

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

      // === PROGRESSIVE DRAFT STATE ===
      // This state accumulates as Claude calls the draft tools
      interface DraftState {
        project: {
          name: string;
          description?: string;
          startDate?: string;
          endDate?: string;
          tags: Array<{ name: string; color?: string }>;
        } | null;
        tasklists: Array<{
          id: string;
          name: string;
          description?: string;
          tasks: Array<{
            id: string;
            name: string;
            description?: string;
            priority?: "none" | "low" | "medium" | "high";
            dueDate?: string;
            startDate?: string;
            estimatedMinutes?: number;
            tags: Array<{ name: string; color?: string }>;
            subtasks: Array<{
              id: string;
              name: string;
              description?: string;
              dueDate?: string;
            }>;
          }>;
        }>;
        budget?: { type: "time" | "money"; capacity: number };
        nextTasklistNum: number;
        nextTaskNum: number;
        nextSubtaskNum: number;
      }

      const draftState: DraftState = {
        project: null,
        tasklists: [],
        nextTasklistNum: 1,
        nextTaskNum: 1,
        nextSubtaskNum: 1,
      };

      // Helper to calculate summary
      const getDraftSummary = () => ({
        totalTasklists: draftState.tasklists.length,
        totalTasks: draftState.tasklists.reduce(
          (sum, tl) => sum + tl.tasks.length,
          0
        ),
        totalSubtasks: draftState.tasklists.reduce(
          (sum, tl) =>
            sum + tl.tasks.reduce((s, t) => s + t.subtasks.length, 0),
          0
        ),
      });

      // Create project draft MCP server with closure access to safeEnqueue
      const projectDraftMcpServer = createSdkMcpServer({
        name: "project_draft",
        tools: [
          // Initialize project draft
          tool(
            "init_project_draft",
            "Start building a new project structure. Call this first with project details.",
            {
              name: z.string().describe("Project name"),
              description: z
                .string()
                .optional()
                .describe("Project description"),
              startDate: z
                .string()
                .optional()
                .describe("Start date YYYY-MM-DD"),
              endDate: z.string().optional().describe("End date YYYY-MM-DD"),
              tags: z
                .array(
                  z.object({
                    name: z.string(),
                    color: z.string().optional(),
                  })
                )
                .optional()
                .describe("Project tags"),
            },
            async ({ name, description, startDate, endDate, tags }) => {
              console.log("init_project_draft:", name);

              draftState.project = {
                name,
                description,
                startDate,
                endDate,
                tags: (tags || []) as Array<{ name: string; color?: string }>,
              };

              // Emit SSE event immediately
              safeEnqueue(
                `data: ${JSON.stringify({
                  type: "project_draft_init",
                  draft: {
                    project: draftState.project,
                    tasklists: [],
                    summary: getDraftSummary(),
                    isBuilding: true,
                    isDraft: true,
                  },
                })}\n\n`
              );

              return {
                content: [
                  {
                    type: "text",
                    text: `Project "${name}" initialized. Now add tasklists.`,
                  },
                ],
              };
            }
          ),

          // Add a tasklist
          tool(
            "add_tasklist_draft",
            "Add a tasklist (phase/category) to the project draft. The UI will show it immediately.",
            {
              name: z
                .string()
                .describe(
                  'Tasklist name (e.g., "Phase 1: Planning", "Design", "Development")'
                ),
              description: z
                .string()
                .optional()
                .describe("What this phase/category covers"),
            },
            async ({ name, description }) => {
              const id = `tl-${draftState.nextTasklistNum++}`;
              console.log("add_tasklist_draft:", id, name);

              const tasklist = { id, name, description, tasks: [] };
              draftState.tasklists.push(tasklist);

              // Emit SSE update
              safeEnqueue(
                `data: ${JSON.stringify({
                  type: "project_draft_update",
                  action: "add_tasklist",
                  tasklist,
                })}\n\n`
              );

              return {
                content: [
                  {
                    type: "text",
                    text: `Tasklist "${name}" added with id=${id}. Use this id when adding tasks.`,
                  },
                ],
              };
            }
          ),

          // Add a task to a tasklist
          tool(
            "add_task_draft",
            "Add a task to a tasklist. The UI will show it immediately.",
            {
              tasklistId: z.string().describe('The tasklist ID (e.g., "tl-1")'),
              name: z.string().describe("Task name"),
              description: z.string().optional().describe("Task description"),
              priority: z
                .enum(["none", "low", "medium", "high"])
                .optional()
                .describe("Task priority"),
              dueDate: z.string().optional().describe("Due date YYYY-MM-DD"),
              startDate: z
                .string()
                .optional()
                .describe("Start date YYYY-MM-DD"),
              estimatedMinutes: z
                .number()
                .optional()
                .describe("Estimated time in minutes"),
              tags: z
                .array(
                  z.object({
                    name: z.string(),
                    color: z.string().optional(),
                  })
                )
                .optional()
                .describe("Task tags"),
            },
            async ({
              tasklistId,
              name,
              description,
              priority,
              dueDate,
              startDate,
              estimatedMinutes,
              tags,
            }) => {
              const id = `t-${draftState.nextTaskNum++}`;
              console.log("add_task_draft:", id, name, "to", tasklistId);

              const tasklist = draftState.tasklists.find(
                (tl) => tl.id === tasklistId
              );

              if (!tasklist) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Error: Tasklist ${tasklistId} not found. Create it first with add_tasklist_draft.`,
                    },
                  ],
                  isError: true,
                };
              }

              const task = {
                id,
                name,
                description,
                priority: priority || ("none" as const),
                dueDate,
                startDate,
                estimatedMinutes,
                tags: (tags || []) as Array<{ name: string; color?: string }>,
                subtasks: [] as Array<{
                  id: string;
                  name: string;
                  description?: string;
                  dueDate?: string;
                }>,
              };
              tasklist.tasks.push(task);

              // Emit SSE update
              safeEnqueue(
                `data: ${JSON.stringify({
                  type: "project_draft_update",
                  action: "add_task",
                  tasklistId,
                  task,
                })}\n\n`
              );

              return {
                content: [
                  {
                    type: "text",
                    text: `Task "${name}" added with id=${id}. Use this id when adding subtasks.`,
                  },
                ],
              };
            }
          ),

          // Add subtasks to a task (batch)
          tool(
            "add_subtasks_draft",
            "Add multiple subtasks to a task. The UI will show them immediately.",
            {
              taskId: z.string().describe('The task ID (e.g., "t-1")'),
              subtasks: z
                .array(
                  z.object({
                    name: z.string().describe("Subtask name"),
                    description: z.string().optional(),
                    dueDate: z.string().optional(),
                  })
                )
                .describe("Array of subtasks to add"),
            },
            async ({ taskId, subtasks }) => {
              console.log(
                "add_subtasks_draft:",
                subtasks.length,
                "subtasks to",
                taskId
              );

              // Find the task
              let foundTask:
                | (typeof draftState.tasklists)[0]["tasks"][0]
                | null = null;
              for (const tl of draftState.tasklists) {
                const task = tl.tasks.find((t) => t.id === taskId);
                if (task) {
                  foundTask = task;
                  break;
                }
              }

              if (!foundTask) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Error: Task ${taskId} not found. Create it first with add_task_draft.`,
                    },
                  ],
                  isError: true,
                };
              }

              const newSubtasks = subtasks.map((st) => ({
                id: `st-${draftState.nextSubtaskNum++}`,
                name: st.name,
                description: st.description,
                dueDate: st.dueDate,
              }));
              foundTask.subtasks.push(...newSubtasks);

              // Emit SSE update
              safeEnqueue(
                `data: ${JSON.stringify({
                  type: "project_draft_update",
                  action: "add_subtasks",
                  taskId,
                  subtasks: newSubtasks,
                })}\n\n`
              );

              return {
                content: [
                  {
                    type: "text",
                    text: `Added ${newSubtasks.length} subtasks to task ${taskId}.`,
                  },
                ],
              };
            }
          ),

          // Set project budget
          tool(
            "set_project_budget",
            "Set the project budget (optional).",
            {
              type: z.enum(["time", "money"]).describe("Budget type"),
              capacity: z
                .number()
                .describe("Budget capacity (hours for time, amount for money)"),
            },
            async ({ type, capacity }) => {
              console.log("set_project_budget:", type, capacity);

              draftState.budget = { type, capacity };

              // Emit SSE update
              safeEnqueue(
                `data: ${JSON.stringify({
                  type: "project_draft_update",
                  action: "set_budget",
                  budget: draftState.budget,
                })}\n\n`
              );

              return {
                content: [
                  {
                    type: "text",
                    text: `Budget set: ${capacity} ${
                      type === "time" ? "hours" : "currency units"
                    }`,
                  },
                ],
              };
            }
          ),

          // Finalize the draft
          tool(
            "finalize_project_draft",
            "Complete the project draft. Call this when done building the structure.",
            {
              message: z
                .string()
                .optional()
                .describe("Summary message to show user"),
            },
            async ({ message: summaryMessage }) => {
              console.log("finalize_project_draft");

              // Emit complete event
              safeEnqueue(
                `data: ${JSON.stringify({
                  type: "project_draft_complete",
                  message:
                    summaryMessage || "Project structure is ready for review!",
                })}\n\n`
              );

              // Also emit the final project_draft for backward compatibility
              safeEnqueue(
                `data: ${JSON.stringify({
                  type: "project_draft",
                  draft: {
                    project: draftState.project,
                    tasklists: draftState.tasklists,
                    budget: draftState.budget,
                    summary: getDraftSummary(),
                    message: summaryMessage || "",
                    isDraft: true,
                    isBuilding: false,
                  },
                })}\n\n`
              );

              return {
                content: [
                  {
                    type: "text",
                    text: `Project draft finalized with ${
                      getDraftSummary().totalTasklists
                    } tasklists, ${getDraftSummary().totalTasks} tasks, and ${
                      getDraftSummary().totalSubtasks
                    } subtasks.`,
                  },
                ],
              };
            }
          ),
        ],
      });

      const options: Options = {
        cwd: process.cwd(),
        model: "opus",
        mcpServers: {
          teamwork: teamworkMcpServer,
          project_draft: projectDraftMcpServer,
        },
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
        maxTurns: 500, // High limit to allow for many progressive tool calls
        env: process.env,
        ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
        stderr: (data: string) => console.log("Project Agent STDERR:", data),
      };

      try {
        console.log("=== PROJECT CREATION AGENT (Progressive) ===");
        console.log("Message:", message.slice(0, 200));

        safeEnqueue(
          `data: ${JSON.stringify({
            type: "init",
            model: "project-agent",
            info: projectDraft ? "Updating your project draft..." : "Analyzing your project requirements...",
          })}\n\n`
        );

        // Use fullPrompt which includes conversation history context
        for await (const event of query({ prompt: fullPrompt, options })) {
          if (event.type === "stream_event") {
            const streamEvent = event.event;
            if (streamEvent.type === "content_block_delta") {
              const delta = (streamEvent as any).delta;
              if (delta?.type === "text_delta" && delta.text) {
                fullText += delta.text;
                // Stream text as thinking (Claude's reasoning)
                safeEnqueue(
                  `data: ${JSON.stringify({
                    type: "thinking",
                    thinking: delta.text,
                  })}\n\n`
                );
              }
            }
          } else if (event.type === "result") {
            fullText = (event as any).result || fullText;
          }
        }

        // SAFETY VALIDATION: Check agent response for any unsafe patterns
        const validation = validateAgentResponse(fullText);
        if (!validation.safe) {
          console.error(
            "SAFETY: Blocked unsafe project agent response:",
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

        // Send final text result (Claude's concluding message)
        // Remove JSON Lines and markdown JSON blocks from the output
        let cleanText = fullText
          // Remove markdown JSON blocks
          .replace(/```json[\s\S]*?```/g, "")
          // Remove JSON Lines (any line that looks like a JSON object with "type" field)
          .split('\n')
          .filter(line => {
            const trimmed = line.trim();
            // Filter out any line that looks like JSON with a type field
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              // Check if it contains "type": pattern (our JSON Lines format)
              if (/"type"\s*:/.test(trimmed)) {
                return false;
              }
            }
            return true;
          })
          .join('\n')
          .trim();

        if (cleanText) {
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "result",
              text: cleanText,
            })}\n\n`
          );
        }

        safeEnqueue("data: [DONE]\n\n");
        safeClose();
      } catch (error) {
        console.error("Project agent error:", error);
        safeEnqueue(
          `data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          })}\n\n`
        );
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Timelog mode - uses timelog agent with MCP tools for intelligent time logging
async function handleTimelogChat(body: {
  message: string;
  mode?: string;
  projectId?: number;
  projectName?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}) {
  const { message, projectId, projectName, conversationHistory } = body;

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

// Submit project (called when user confirms project draft)
async function handleProjectSubmit(body: {
  project: {
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    tags?: Array<{ name: string; color?: string }>;
  };
  tasklists: Array<{
    name: string;
    description?: string;
    tasks: Array<{
      name: string;
      description?: string;
      priority?: string;
      startDate?: string;
      dueDate?: string;
      estimatedMinutes?: number;
      tags?: Array<{ name: string }>;
      subtasks?: Array<{ name: string; description?: string }>;
    }>;
  }>;
  budget?: {
    type: "time" | "money";
    capacity: number;
  };
}) {
  const { project, tasklists, budget } = body;

  if (!project?.name) {
    return jsonResponse({ error: "Project name is required" }, 400);
  }

  try {
    // 1. Create the project
    console.log("Creating project with options:", {
      name: project.name,
      description: project.description,
      startDate: project.startDate?.replace(/-/g, ""),
      endDate: project.endDate?.replace(/-/g, ""),
    });

    const projectResult = await teamwork.projects.create({
      name: project.name,
      description: project.description,
      startDate: project.startDate?.replace(/-/g, ""),
      endDate: project.endDate?.replace(/-/g, ""),
    });

    console.log("Project creation result:", projectResult);

    if (!projectResult?.id) {
      throw new Error("Project creation failed - no ID returned");
    }

    const projectId = parseInt(projectResult.id, 10);
    console.log(`Created project: ${projectId} - ${project.name}`);

    let totalTasksCreated = 0;
    let totalSubtasksCreated = 0;

    // 2. Create task lists and tasks
    for (const tasklist of tasklists || []) {
      const tasklistResult = await teamwork.projects.createTasklist(projectId, {
        name: tasklist.name,
        description: tasklist.description,
      });

      const tasklistId = parseInt(tasklistResult.id, 10);
      console.log(`Created tasklist: ${tasklistId} - ${tasklist.name}`);

      // 3. Create tasks in each list
      for (const task of tasklist.tasks || []) {
        try {
          console.log(
            `Creating task: ${task.name} with dueDate: ${task.dueDate}, priority: ${task.priority}, estimatedMinutes: ${task.estimatedMinutes}`
          );

          const createdTask = await teamwork.tasks.create(tasklistId, {
            name: task.name,
            description: task.description,
            priority: (task.priority === "none"
              ? undefined
              : task.priority) as any,
            dueDate: task.dueDate,
            startDate: task.startDate,
            estimatedMinutes: task.estimatedMinutes,
          });

          totalTasksCreated++;
          console.log(`Created task: ${createdTask.id} - ${task.name}`);

          // 4. Create subtasks
          for (const subtask of task.subtasks || []) {
            try {
              await teamwork.http.post(
                `/projects/api/v3/tasks/${createdTask.id}/subtasks.json`,
                {
                  task: {
                    name: subtask.name,
                    description: subtask.description,
                  },
                }
              );
              totalSubtasksCreated++;
            } catch (err) {
              console.error(`Failed to create subtask: ${subtask.name}`, err);
            }
          }
        } catch (err: any) {
          console.error(`Failed to create task: ${task.name}`);
          console.error("Error details:", err?.body || err?.message || err);
          // Continue with other tasks even if one fails
        }
      }
    }

    const tasklistCount = tasklists?.length || 0;
    return jsonResponse({
      success: true,
      projectId,
      projectName: project.name,
      projectUrl: `${TEAMWORK_API_URL}/app/projects/${projectId}`,
      summary: {
        tasklistsCreated: tasklistCount,
        tasksCreated: totalTasksCreated,
        subtasksCreated: totalSubtasksCreated,
      },
      message: `Successfully created project "${project.name}" with ${tasklistCount} task lists and ${totalTasksCreated} tasks.`,
    });
  } catch (err) {
    console.error("Project creation error:", err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Failed to create project",
        success: false,
      },
      500
    );
  }
}

// Update an existing project (edit mode)
async function handleProjectUpdate(body: {
  projectId: number;
  project: {
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    tags?: Array<{ name: string; color?: string }>;
  };
  tasklists: Array<{
    id: string; // "tl-123" for existing, "tl-new-1" for new
    name: string;
    description?: string;
    tasks: Array<{
      id: string; // "t-123" for existing, "t-new-1" for new
      name: string;
      description?: string;
      priority?: string;
      startDate?: string;
      dueDate?: string;
      estimatedMinutes?: number;
      tags?: Array<{ name: string }>;
      subtasks?: Array<{
        id: string; // "st-123" for existing, "st-new-1" for new
        name: string;
        description?: string;
      }>;
    }>;
  }>;
}) {
  const { projectId, project, tasklists } = body;

  if (!projectId) {
    return jsonResponse({ error: "Project ID is required" }, 400);
  }

  try {
    // 1. Update project basic info
    console.log("Updating project:", projectId, project.name);
    await teamwork.projects.update(projectId, {
      name: project.name,
      description: project.description,
      startDate: project.startDate?.replace(/-/g, ""),
      endDate: project.endDate?.replace(/-/g, ""),
    });

    let tasklistsCreated = 0;
    let tasklistsUpdated = 0;
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let subtasksCreated = 0;
    let subtasksUpdated = 0;

    // Helper to extract Teamwork ID from our ID format
    const extractId = (id: string): number | null => {
      const match = id.match(/^(?:tl|t|st)-(\d+)$/);
      return match ? parseInt(match[1], 10) : null;
    };

    const isNewId = (id: string): boolean => {
      return id.includes("-new-");
    };

    // 2. Process tasklists
    for (const tasklist of tasklists || []) {
      let tasklistId: number;

      if (isNewId(tasklist.id)) {
        // Create new tasklist
        console.log(`Creating new tasklist: ${tasklist.name}`);
        const result = await teamwork.projects.createTasklist(projectId, {
          name: tasklist.name,
          description: tasklist.description,
        });
        tasklistId = parseInt(result.id, 10);
        tasklistsCreated++;
      } else {
        // Update existing tasklist
        tasklistId = extractId(tasklist.id)!;
        console.log(`Updating tasklist ${tasklistId}: ${tasklist.name}`);
        await teamwork.http.put(`/projects/api/v3/tasklists/${tasklistId}.json`, {
          tasklist: {
            name: tasklist.name,
            description: tasklist.description,
          },
        });
        tasklistsUpdated++;
      }

      // 3. Process tasks in this tasklist
      for (const task of tasklist.tasks || []) {
        let taskId: number;

        if (isNewId(task.id)) {
          // Create new task
          console.log(`Creating new task: ${task.name} in tasklist ${tasklistId}`);
          const createdTask = await teamwork.tasks.create(tasklistId, {
            name: task.name,
            description: task.description,
            priority: (task.priority === "none" ? undefined : task.priority) as any,
            dueDate: task.dueDate,
            startDate: task.startDate,
            estimatedMinutes: task.estimatedMinutes,
          });
          taskId = createdTask.id;
          tasksCreated++;
        } else {
          // Update existing task
          taskId = extractId(task.id)!;
          console.log(`Updating task ${taskId}: ${task.name}`);
          await teamwork.tasks.update(taskId, {
            name: task.name,
            description: task.description,
            priority: (task.priority === "none" ? undefined : task.priority) as any,
            dueDate: task.dueDate,
            startDate: task.startDate,
            estimatedMinutes: task.estimatedMinutes,
          });
          tasksUpdated++;
        }

        // 4. Process subtasks
        for (const subtask of task.subtasks || []) {
          if (isNewId(subtask.id)) {
            // Create new subtask
            console.log(`Creating new subtask: ${subtask.name} for task ${taskId}`);
            await teamwork.http.post(`/projects/api/v3/tasks/${taskId}/subtasks.json`, {
              task: {
                name: subtask.name,
                description: subtask.description,
              },
            });
            subtasksCreated++;
          } else {
            // Update existing subtask
            const subtaskId = extractId(subtask.id)!;
            console.log(`Updating subtask ${subtaskId}: ${subtask.name}`);
            await teamwork.http.put(`/projects/api/v3/tasks/${subtaskId}.json`, {
              task: {
                name: subtask.name,
                description: subtask.description,
              },
            });
            subtasksUpdated++;
          }
        }
      }
    }

    return jsonResponse({
      success: true,
      projectId,
      projectName: project.name,
      projectUrl: `${TEAMWORK_API_URL}/app/projects/${projectId}`,
      summary: {
        tasklistsCreated,
        tasklistsUpdated,
        tasksCreated,
        tasksUpdated,
        subtasksCreated,
        subtasksUpdated,
      },
      message: `Successfully updated project "${project.name}". Created: ${tasksCreated} tasks, ${subtasksCreated} subtasks. Updated: ${tasksUpdated} tasks, ${subtasksUpdated} subtasks.`,
    });
  } catch (err) {
    console.error("Project update error:", err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Failed to update project",
        success: false,
      },
      500
    );
  }
}

// Generate a title for a conversation from the first message
async function handleGenerateTitle(body: {
  message: string;
}): Promise<Response> {
  const { message } = body;

  if (!message) {
    return jsonResponse({ error: "Message is required" }, 400);
  }

  try {
    // Use Claude to generate a short, descriptive title
    const prompt = `Generate a very short title (3-6 words) for a conversation that starts with this message.
Return ONLY the title, no quotes or punctuation at the end.

Message: "${message.slice(0, 500)}"

Title:`;

    const options: Options = {
      maxTokens: 30,
      system:
        "You are a title generator. Generate concise, descriptive titles for conversations.",
    };

    let resultText = "";
    for await (const event of query({ prompt, options })) {
      if (event.type === "result" && event.subtype === "success") {
        resultText = event.result || "";
      }
    }

    // Extract the title from the response
    const title = resultText
      .trim()
      .replace(/^["']|["']$/g, "")
      .slice(0, 100);

    return jsonResponse({ title });
  } catch (err) {
    console.error("Title generation error:", err);
    // Fallback: use first 50 chars of message
    const fallbackTitle =
      message.slice(0, 50) + (message.length > 50 ? "..." : "");
    return jsonResponse({ title: fallbackTitle });
  }
}

// Submit timelog entries (called when user confirms draft)
async function handleTimelogSubmit(body: {
  entries: Array<{
    taskId: number;
    hours: number;
    date: string;
    comment: string;
  }>;
}) {
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

// ============================================================================
// AI VISUALIZATION REQUEST HANDLER - Use AI to create custom visualizations
// ============================================================================
async function handleVisualizeRequest(body: {
  prompt: string;
  projectId?: number;
}) {
  const { prompt, projectId } = body;

  if (!prompt) {
    return new Response("Prompt is required", {
      status: 400,
      headers: corsHeaders,
    });
  }

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
        console.log("=== AI VISUALIZATION REQUEST ===");
        console.log("Prompt:", prompt);
        console.log("Project:", projectId);

        // Get current user
        const person = await teamwork.people.me();
        const userId = person.id;

        // Parse date range from prompt
        const dateRange = parseDateRange(prompt);

        // Fetch time data
        const response = await teamwork.timeEntries.list({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          include: ["tasks", "projects"],
          orderBy: "date",
          orderMode: "asc",
          pageSize: 500,
          ...(projectId ? { projectIds: [projectId] } : {}),
        });

        const entries = (response.timelogs || []).filter(
          (t: any) => t.userId === userId
        );
        const included = response.included || {};

        // Build time data structure for AI
        const timeData = {
          entryCount: entries.length,
          totalHours: entries.reduce(
            (sum: number, e: any) => sum + (e.minutes || 0) / 60,
            0
          ),
          entries: entries.map((e: any) => ({
            date: e.timeLogged || e.date,
            hours: (e.minutes || 0) / 60,
            taskName:
              included?.tasks?.[String(e.taskId)]?.name || `Task #${e.taskId}`,
            projectName:
              included?.projects?.[String(e.projectId)]?.name ||
              `Project #${e.projectId}`,
            description: e.description,
          })),
        };

        console.log(
          "Fetched",
          entries.length,
          "entries, sending to AI visualization agent"
        );

        // Use AI visualization agent to create custom visualization
        const vizSpecs = await runVisualizationAgent({
          question: prompt,
          data: timeData,
          periodLabel: dateRange.label,
        });

        // Send all visualizations
        if (vizSpecs && Array.isArray(vizSpecs)) {
          for (const spec of vizSpecs) {
            console.log("Sending AI visualization:", spec.type);
            safeEnqueue(
              `data: ${JSON.stringify({ type: "visualization", spec })}\n\n`
            );
          }
        }

        safeEnqueue("data: [DONE]\n\n");
        safeClose();
      } catch (err) {
        console.error("Visualization request error:", err);
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
      Connection: "keep-alive",
      ...corsHeaders,
    },
  });
}

// Simple API endpoints for direct Teamwork access
async function handleProjectsList() {
  try {
    // Fetch all active projects from Teamwork API
    const response = await teamwork.projects.list({
      status: "active",
      pageSize: 100,
      orderBy: "name",
      orderMode: "asc",
    });

    // Map to simplified format
    const projects = response.projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    }));

    return jsonResponse({ projects });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Failed to fetch projects:", detail, err);
    return errorResponse(`Failed to fetch projects: ${detail}`);
  }
}

async function handleTasksList(projectId: number) {
  try {
    const tasks = await teamwork.tasks.listByProject(projectId, {
      include: ["tags", "assignees"],
      pageSize: 50,
    });
    return jsonResponse(tasks);
  } catch (err) {
    return errorResponse("Failed to fetch tasks");
  }
}

// Get full project structure for editing (tasklists + tasks + subtasks)
async function handleProjectStructure(projectId: number) {
  try {
    // Fetch project details
    const project = await teamwork.projects.get(projectId);

    // Fetch tasklists for the project
    const tasklistsResponse = await teamwork.projects.getTasklists(projectId);

    // Fetch all tasks for the project
    const tasksResponse = await teamwork.tasks.listByProject(projectId, {
      include: ["tags"],
      pageSize: 500,
      includeCompletedTasks: true,
    });

    // Group tasks by tasklist (exclude subtasks - they have parentTaskId)
    const tasksByTasklist: Record<number, typeof tasksResponse.tasks> = {};
    for (const task of tasksResponse.tasks) {
      // Skip subtasks - they have a parentTaskId
      if (task.parentTaskId) continue;

      const tasklistId = task.tasklistId;
      if (tasklistId) {
        if (!tasksByTasklist[tasklistId]) {
          tasksByTasklist[tasklistId] = [];
        }
        tasksByTasklist[tasklistId].push(task);
      }
    }

    // Fetch subtasks for each parent task (in parallel batches)
    const taskSubtasks: Record<number, Array<{ id: number; name: string; description?: string }>> = {};
    // Only get subtasks for parent tasks (not subtasks themselves)
    const parentTaskIds = tasksResponse.tasks
      .filter((t) => !t.parentTaskId)
      .map((t) => t.id);

    // Fetch subtasks in batches of 10
    const batchSize = 10;
    for (let i = 0; i < parentTaskIds.length; i += batchSize) {
      const batch = parentTaskIds.slice(i, i + batchSize);
      const subtaskPromises = batch.map(async (taskId) => {
        try {
          const response = await teamwork.http.get(
            `/projects/api/v3/tasks/${taskId}/subtasks.json`
          ) as { tasks?: Array<{ id: number; name: string; description?: string }> };
          return { taskId, subtasks: response.tasks || [] };
        } catch {
          return { taskId, subtasks: [] };
        }
      });
      const results = await Promise.all(subtaskPromises);
      for (const { taskId, subtasks } of results) {
        taskSubtasks[taskId] = subtasks;
      }
    }

    // Build the structure matching ProjectDraftData format
    const tasklists = tasklistsResponse.tasklists.map((tl) => ({
      id: `tl-${tl.id}`,
      name: tl.name,
      description: tl.description || "",
      tasks: (tasksByTasklist[tl.id] || []).map((task) => ({
        id: `t-${task.id}`,
        name: task.name,
        description: task.description || "",
        priority: (task.priority || "none") as "none" | "low" | "medium" | "high",
        startDate: task.startDate || undefined,
        dueDate: task.dueDate || undefined,
        estimatedMinutes: task.estimatedMinutes || 0,
        tags: (task.tags || []).map((tag: any) => ({
          name: tag.name || tag,
          color: tag.color,
        })),
        subtasks: (taskSubtasks[task.id] || []).map((st) => ({
          id: `st-${st.id}`,
          name: st.name,
          description: st.description || "",
        })),
      })),
    }));

    // Calculate summary
    const totalTasks = tasklists.reduce((sum, tl) => sum + tl.tasks.length, 0);
    const totalSubtasks = tasklists.reduce(
      (sum, tl) => sum + tl.tasks.reduce((s, t) => s + t.subtasks.length, 0),
      0
    );
    const totalMinutes = tasklists.reduce(
      (sum, tl) => sum + tl.tasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0),
      0
    );

    return jsonResponse({
      project: {
        name: project.name,
        description: project.description || "",
        startDate: project.startDate || undefined,
        endDate: project.endDate || undefined,
        tags: [],
      },
      tasklists,
      summary: {
        totalTasklists: tasklists.length,
        totalTasks,
        totalSubtasks,
        totalMinutes,
      },
      message: `Loaded project "${project.name}" with ${tasklists.length} tasklists, ${totalTasks} tasks, and ${totalSubtasks} subtasks.`,
      isDraft: true,
      isExisting: true, // Flag to indicate this is an existing project being edited
      existingProjectId: projectId,
    });
  } catch (err) {
    console.error("Failed to fetch project structure:", err);
    return errorResponse("Failed to fetch project structure");
  }
}

async function handleTimeEntriesList(projectId?: number) {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const response = await teamwork.timeEntries.list({
      startDate: thirtyDaysAgo.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
      include: ["tasks", "projects"],
      pageSize: 100,
      ...(projectId ? { projectIds: [projectId] } : {}),
    });
    return jsonResponse(response);
  } catch (err) {
    return errorResponse("Failed to fetch time entries");
  }
}

// ============================================================================
// WEBHOOK HANDLER - Receives Teamwork webhook events
// ============================================================================

// Store for recent webhook events (for debugging/display)
const recentWebhookEvents: Array<{
  id: string;
  event: string;
  timestamp: string;
  payload: any;
}> = [];
const MAX_STORED_EVENTS = 100;

// HMAC signature verification for webhook security
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!secret || !signature) return true; // Skip verification if no secret configured

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedSignature === signature;
}

interface TeamworkWebhookPayload {
  eventCreator?: { id: number; firstName?: string; lastName?: string };
  task?: {
    id: number;
    name: string;
    description?: string;
    projectId?: number;
    taskListId?: number;
    status?: string;
    tags?: Array<{ id: number; name: string; color?: string }>;
    workflowsStages?: Array<{ stageId: number; workflowId: number }>;
  };
  project?: { id: number; name: string };
  event: string;
  accountId?: number;
}

async function handleWebhook(req: Request): Promise<Response> {
  const webhookSecret = process.env.WEBHOOK_SECRET || "";

  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("X-Teamwork-Signature") ||
      req.headers.get("Signature") ||
      "";

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = await verifyWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );
      if (!isValid) {
        console.warn("[Webhook] Invalid signature, rejecting request");
        return errorResponse("Invalid signature", 401);
      }
    }

    const payload: TeamworkWebhookPayload = JSON.parse(rawBody);
    const eventType =
      req.headers.get("X-Projects-Event") ||
      req.headers.get("X-Teamwork-Event") ||
      req.headers.get("Event") ||
      payload.event ||
      "unknown";
    const deliveryId =
      req.headers.get("X-Projects-Delivery") ||
      req.headers.get("X-Teamwork-Delivery") ||
      req.headers.get("Delivery") ||
      crypto.randomUUID();

    console.log(`[Webhook] Received event: ${eventType}`);
    console.log(`[Webhook] Delivery ID: ${deliveryId}`);
    console.log(`[Webhook] Payload:`, JSON.stringify(payload, null, 2));

    // Store event for debugging
    recentWebhookEvents.unshift({
      id: deliveryId,
      event: eventType,
      timestamp: new Date().toISOString(),
      payload,
    });

    // Trim old events
    if (recentWebhookEvents.length > MAX_STORED_EVENTS) {
      recentWebhookEvents.length = MAX_STORED_EVENTS;
    }

    // Handle specific events (TASK.UPDATED is sent when tasks are moved between stages)
    if (eventType === "TASK.MOVED" || eventType === "TASK.UPDATED") {
      const task = payload.task;
      const projectId = payload.project?.id || task?.projectId;
      console.log(`[Webhook] Task moved: ${task?.name} (ID: ${task?.id}, Project: ${projectId})`);

      // Check for FellowAI tag
      const hasFellowAITag = task?.tags?.some(
        (t) => t.name.toLowerCase() === "fellowai"
      );

      // Check if project has agent config
      const projectConfig = getProjectAgentConfig(projectId);

      if (hasFellowAITag && task?.workflowsStages?.[0]) {
        const { stageId, workflowId } = task.workflowsStages[0];

        // Look up stage name (async)
        (async () => {
          try {
            const stage = await teamwork.workflows.getStage(
              workflowId,
              stageId
            );
            console.log(`[Webhook] Task moved to stage: "${stage.name}"`);

            // Check if moved to "In progress"
            if (stage.name.toLowerCase() === "in progress") {
              // Determine working directory based on project config
              const agentCwd = projectConfig?.cwd || process.cwd();
              const agentModel = projectConfig?.model || "claude-sonnet-4-20250514";

              console.log(
                `[Webhook] FellowAI task moved to In Progress - executing AI in ${agentCwd}...`
              );

              // Execute AI with task description
              const prompt = task.description || task.name;

              // Post "starting" comment with project info
              const projectInfo = projectConfig
                ? `\n\n📁 **Project:** ${projectConfig.projectName}\n📂 **Working Directory:** \`${projectConfig.cwd}\``
                : "";

              await teamwork.comments.createForTask(task.id, {
                body: `🤖 **AI Execution Started**\n\nProcessing task description as prompt...${projectInfo}`,
                contentType: "MARKDOWN",
              });

              // Run AI agent with project-specific cwd
              const options: Options = {
                model: agentModel,
                cwd: agentCwd,
                env: process.env,
                ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
              };

              let resultText = "";
              for await (const event of query({ prompt, options })) {
                if (event.type === "result" && event.subtype === "success") {
                  resultText = event.result || "";
                }
              }

              // Post result as comment
              await teamwork.comments.createForTask(task.id, {
                body: `🤖 **AI Execution Complete**\n\n${
                  resultText || "No output generated."
                }`,
                contentType: "MARKDOWN",
              });

              console.log(
                `[Webhook] AI execution complete for task ${task.id}`
              );
            }
          } catch (err) {
            console.error(`[Webhook] Error processing FellowAI task:`, err);
            // Post error comment
            if (task?.id) {
              teamwork.comments
                .createForTask(task.id, {
                  body: `❌ **AI Execution Failed**\n\n\`\`\`\n${err}\n\`\`\``,
                  contentType: "MARKDOWN",
                })
                .catch(() => {});
            }
          }
        })();
      }
    }

    // Return success - Teamwork expects 2xx response
    return jsonResponse({
      received: true,
      event: eventType,
      deliveryId,
    });
  } catch (err) {
    console.error("[Webhook] Error processing webhook:", err);
    return errorResponse("Failed to process webhook", 400);
  }
}

// Endpoint to view recent webhook events (for debugging)
function handleWebhookEvents(): Response {
  return jsonResponse({
    count: recentWebhookEvents.length,
    events: recentWebhookEvents,
  });
}

// Main request handler
const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0", // Listen on all interfaces (required for Railway/Docker)
  idleTimeout: 255, // Max allowed - SDK with skills can take a while
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Agent SDK streaming endpoint
      if (path === "/api/agent/stream" && req.method === "POST") {
        if (!agentSdkAvailable) {
          return errorResponse("AI features disabled - ANTHROPIC_API_KEY not configured", 503);
        }
        const body = await req.json();
        return handleAgentChat(body);
      }

      // Chart request endpoint
      if (path === "/api/agent/chart" && req.method === "POST") {
        if (!agentSdkAvailable) {
          return errorResponse("AI features disabled - ANTHROPIC_API_KEY not configured", 503);
        }
        const body = await req.json();
        return handleChartRequest(body);
      }

      // AI Visualization request endpoint (custom prompts)
      if (path === "/api/agent/visualize" && req.method === "POST") {
        if (!agentSdkAvailable) {
          return errorResponse("AI features disabled - ANTHROPIC_API_KEY not configured", 503);
        }
        const body = await req.json();
        return handleVisualizeRequest(body);
      }

      // Timelog submit endpoint (confirms and submits draft entries)
      if (path === "/api/agent/timelog/submit" && req.method === "POST") {
        const body = await req.json();
        return handleTimelogSubmit(body);
      }

      // Project submit endpoint (confirms and creates project from draft)
      if (path === "/api/agent/project/submit" && req.method === "POST") {
        const body = await req.json();
        return handleProjectSubmit(body);
      }

      // Project update endpoint (edit existing project)
      if (path === "/api/agent/project/update" && req.method === "POST") {
        const body = await req.json();
        return handleProjectUpdate(body);
      }

      // Generate conversation title from first message
      if (path === "/api/generate-title" && req.method === "POST") {
        const body = await req.json();
        return handleGenerateTitle(body);
      }

      // Debug endpoint for Teamwork API connection
      if (path === "/api/debug/teamwork" && req.method === "GET") {
        try {
          // Test using the actual Teamwork client (same code path as /api/projects)
          const response = await teamwork.projects.list({
            status: "active",
            pageSize: 1,
          });
          return jsonResponse({
            success: true,
            projectCount: response.projects.length,
            firstProject: response.projects[0]?.name,
          });
        } catch (err: any) {
          return jsonResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
            status: err?.status,
            statusText: err?.statusText,
            body: JSON.stringify(err?.body)?.substring(0, 500),
            stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
          }, 500);
        }
      }

      // Teamwork API endpoints
      if (path === "/api/projects" && req.method === "GET") {
        return handleProjectsList();
      }

      // Get single project details with tasks and stages
      if (path.match(/^\/api\/projects\/\d+$/) && req.method === "GET") {
        const projectId = parseInt(path.split("/")[3]);

        try {
          // Fetch project details from API
          const project = await teamwork.projects.get(projectId);

          // Fetch tasks for the project
          const tasksResponse = await teamwork.tasks.listByProject(projectId, {
            include: ["tags", "assignees"],
            pageSize: 100,
          });

          // Try to get workflow stages if the project has a workflow
          let stages: Array<{ id: number; name: string; color?: string }> = [];
          try {
            const workflowId = project.activeWorkflow?.id;
            if (workflowId) {
              const stagesResponse = await teamwork.workflows.listStages(
                workflowId
              );
              stages = stagesResponse.map((s: any) => ({
                id: s.id,
                name: s.name,
                color: s.color,
              }));
            }
          } catch {
            // Workflow not found, use default stages
            stages = [
              { id: 1, name: "To Do", color: "#6b7280" },
              { id: 2, name: "In Progress", color: "#3b82f6" },
              { id: 3, name: "Done", color: "#22c55e" },
            ];
          }

          return jsonResponse({
            project: {
              id: project.id,
              name: project.name,
              description: project.description || "",
            },
            tasklists: [],
            tasks: tasksResponse.tasks.map((t: any) => ({
              id: t.id,
              name: t.name,
              description: t.description || "",
              status: t.status || "active",
              priority: t.priority || "none",
              progress: t.progress || 0,
              estimatedMinutes: t.estimatedMinutes || 0,
              projectId: projectId,
              tags: t.tags || [],
              workflowColumn: t.workflowColumn || null,
            })),
            stages,
          });
        } catch (err) {
          console.error("Error fetching project details:", err);
          return errorResponse("Project not found", 404);
        }
      }

      // Get project structure for editing (tasklists + tasks + subtasks)
      if (
        path.match(/^\/api\/projects\/\d+\/structure$/) &&
        req.method === "GET"
      ) {
        const projectId = parseInt(path.split("/")[3]);
        return handleProjectStructure(projectId);
      }

      if (
        path.startsWith("/api/projects/") &&
        path.endsWith("/tasks") &&
        req.method === "GET"
      ) {
        const projectId = parseInt(path.split("/")[3]);
        return handleTasksList(projectId);
      }

      // Get time entries for a specific project
      if (
        path.match(/^\/api\/projects\/\d+\/time-entries$/) &&
        req.method === "GET"
      ) {
        const projectId = parseInt(path.split("/")[3]);
        return handleTimeEntriesList(projectId);
      }

      if (path === "/api/time-entries" && req.method === "GET") {
        const projectId = url.searchParams.get("projectId");
        return handleTimeEntriesList(
          projectId ? parseInt(projectId) : undefined
        );
      }

      // Webhook endpoints
      if (path === "/api/webhooks/teamwork" && req.method === "POST") {
        return handleWebhook(req);
      }

      if (path === "/api/webhooks/events" && req.method === "GET") {
        return handleWebhookEvents();
      }

      // Health check
      if (path === "/health") {
        return jsonResponse({ status: "ok", sdk: true });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error("Request error:", err);
      return errorResponse("Internal Server Error");
    }
  },
});

console.log(`Agent SDK server running at http://localhost:${PORT}`);
console.log(`Teamwork API: ${TEAMWORK_API_URL}`);
console.log(`Default Project ID: ${DEFAULT_PROJECT_ID}`);
console.log("");
console.log("Skills loaded from:", process.cwd() + "/../../.claude/skills/");
console.log("");
console.log("To use Max subscription, ensure CLAUDE_CODE_OAUTH_TOKEN is set:");
console.log("  1. Run: claude setup-token");
console.log('  2. Set: export CLAUDE_CODE_OAUTH_TOKEN="your-token"');
