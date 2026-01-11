// lib/handlers/project.ts
// Project creation and management handlers

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { corsHeaders, jsonResponse } from '../utils/response.ts';
import { validateAgentResponse } from '../utils/safety.ts';
import type { TeamworkClient } from "../teamwork_api_client/index.ts";

export interface ProjectChatBody {
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
}

export interface ProjectChatDependencies {
  query: any;
  claudeCodePath: string | undefined;
  teamworkMcpServer: any;
  teamwork: TeamworkClient;
  createSdkMcpServer: any;
  tool: any;
  ALLOWED_PROJECTS: Array<{ id: number; name: string }>;
}

// Extract structured data from Main Agent's response
export function extractDataFromResponse(response: string): any | null {
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

export async function handleProjectChat(
  body: ProjectChatBody,
  deps: ProjectChatDependencies
) {
  const { message, conversationHistory, projectDraft } = body;
  const { query, claudeCodePath, teamworkMcpServer, createSdkMcpServer, tool } = deps;

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
            async ({ name, description, startDate, endDate, tags }: {
              name: string;
              description?: string;
              startDate?: string;
              endDate?: string;
              tags?: Array<{ name: string; color?: string }>;
            }) => {
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
            async ({ name, description }: { name: string; description?: string }) => {
              const id = `tl-${draftState.nextTasklistNum++}`;
              console.log("add_tasklist_draft:", id, name);

              const tasklist = { id, name, description, tasks: [] as DraftState["tasklists"][0]["tasks"] };
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
            }: {
              tasklistId: string;
              name: string;
              description?: string;
              priority?: "none" | "low" | "medium" | "high";
              dueDate?: string;
              startDate?: string;
              estimatedMinutes?: number;
              tags?: Array<{ name: string; color?: string }>;
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
            async ({ taskId, subtasks }: {
              taskId: string;
              subtasks: Array<{ name: string; description?: string; dueDate?: string }>;
            }) => {
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
            async ({ type, capacity }: { type: "time" | "money"; capacity: number }) => {
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
            async ({ message: summaryMessage }: { message?: string }) => {
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

// Submit project (called when user confirms project draft)
export async function handleProjectSubmit(
  body: {
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
  },
  teamwork: TeamworkClient,
  TEAMWORK_API_URL: string | undefined
) {
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
export async function handleProjectUpdate(
  body: {
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
  },
  teamwork: TeamworkClient,
  TEAMWORK_API_URL: string | undefined
) {
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
