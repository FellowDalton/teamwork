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
  const { existsSync, realpathSync } = require("fs");
  const path = require("path");
  const possiblePaths = [
    // Railway/Docker container - installed via npm dependency
    "/app/node_modules/.bin/claude",
    // Local backend node_modules (convert to absolute path)
    path.resolve(process.cwd(), "./node_modules/.bin/claude"),
    // Global npm install
    "/usr/local/bin/claude",
    "/usr/bin/claude",
    // User-local installs
    `${process.env.HOME}/.local/bin/claude`,
    // Local dev (nvm)
    `${process.env.HOME}/.nvm/versions/node/v20.19.5/bin/claude`,
  ];

  for (const p of possiblePaths) {
    try {
      if (existsSync(p)) {
        // Return absolute path to avoid issues with CWD changes
        const absolutePath = path.isAbsolute(p) ? p : realpathSync(p);
        console.log(`Found Claude Code at: ${absolutePath}`);
        return absolutePath;
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

// ============================================================================
// IMPORTS - Extracted modules
// ============================================================================

import { createTeamworkClient } from "./teamwork_api_client/index.ts";

// Config - use getter functions to read env AFTER loading
import {
  getPort,
  getTeamworkApiUrl,
  getTeamworkBearerToken,
  getDefaultProjectId,
  ALLOWED_PROJECTS,
} from "./config.ts";

// Read config values AFTER env loading
const PORT = getPort();
const TEAMWORK_API_URL = getTeamworkApiUrl();
const TEAMWORK_BEARER_TOKEN = getTeamworkBearerToken();
const DEFAULT_PROJECT_ID = getDefaultProjectId();

// Utils
import { corsHeaders, jsonResponse, errorResponse } from "./lib/utils/response.ts";
import { parseDateRange } from "./lib/utils/date-parsing.ts";

// MCP
import { createTeamworkMcpServer } from "./lib/mcp/index.ts";

// Handlers
import { handleAgentChat } from "./lib/handlers/agent-chat.ts";
import { handleChartRequest } from "./lib/handlers/chart.ts";
import { handleTimelogSubmit } from "./lib/handlers/timelog.ts";
import { handleProjectSubmit, handleProjectUpdate } from "./lib/handlers/project.ts";
import { handleVisualizeRequest } from "./lib/handlers/ai-viz.ts";

// ============================================================================
// INITIALIZATION
// ============================================================================

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

// Create MCP server for Teamwork tools (only if SDK available)
let teamworkMcpServer: any = null;
if (agentSdkAvailable) {
  teamworkMcpServer = createTeamworkMcpServer(
    teamwork,
    createSdkMcpServer,
    tool,
    ALLOWED_PROJECTS
  );
}

// ============================================================================
// GENERATE TITLE HANDLER
// ============================================================================

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

// ============================================================================
// SIMPLE API HANDLERS
// ============================================================================

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
    console.error("Failed to fetch projects:", err);
    return errorResponse("Failed to fetch projects");
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
// WEBHOOK HANDLER
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
      console.log(`[Webhook] Task moved: ${task?.name} (ID: ${task?.id})`);

      // Check for FellowAI tag
      const hasFellowAITag = task?.tags?.some(
        (t) => t.name.toLowerCase() === "fellowai"
      );

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
              console.log(
                `[Webhook] FellowAI task moved to In Progress - executing AI...`
              );

              // Execute AI with task description
              const prompt = task.description || task.name;

              // Post "starting" comment
              await teamwork.comments.createForTask(task.id, {
                body: `🤖 **AI Execution Started**\n\nProcessing task description as prompt...`,
                contentType: "MARKDOWN",
              });

              // Run AI agent
              const options: Options = {
                model: "claude-sonnet-4-20250514",
                cwd: process.cwd(),
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

// ============================================================================
// MAIN SERVER
// ============================================================================

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
        return handleAgentChat(body, {
          query,
          claudeCodePath,
          teamworkMcpServer,
          teamwork,
          createSdkMcpServer,
          tool,
          ALLOWED_PROJECTS,
        });
      }

      // Chart request endpoint
      if (path === "/api/agent/chart" && req.method === "POST") {
        if (!agentSdkAvailable) {
          return errorResponse("AI features disabled - ANTHROPIC_API_KEY not configured", 503);
        }
        const body = await req.json();
        return handleChartRequest(body, teamwork);
      }

      // AI Visualization request endpoint (custom prompts)
      if (path === "/api/agent/visualize" && req.method === "POST") {
        if (!agentSdkAvailable) {
          return errorResponse("AI features disabled - ANTHROPIC_API_KEY not configured", 503);
        }
        const body = await req.json();
        return handleVisualizeRequest(body, teamwork, {
          query,
          claudeCodePath,
          agentSdkAvailable,
        });
      }

      // Timelog submit endpoint (confirms and submits draft entries)
      if (path === "/api/agent/timelog/submit" && req.method === "POST") {
        const body = await req.json();
        return handleTimelogSubmit(body, teamwork);
      }

      // Project submit endpoint (confirms and creates project from draft)
      if (path === "/api/agent/project/submit" && req.method === "POST") {
        const body = await req.json();
        return handleProjectSubmit(body, teamwork, TEAMWORK_API_URL);
      }

      // Project update endpoint (edit existing project)
      if (path === "/api/agent/project/update" && req.method === "POST") {
        const body = await req.json();
        return handleProjectUpdate(body, teamwork, TEAMWORK_API_URL);
      }

      // Generate conversation title from first message
      if (path === "/api/generate-title" && req.method === "POST") {
        const body = await req.json();
        return handleGenerateTitle(body);
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
