// lib/mcp/tools.ts
// MCP tool definitions for Teamwork operations (READ-ONLY)

import { z } from "zod";
import type { TeamworkClient } from "../teamwork_api_client/index.ts";

export function createTeamworkTools(
  teamwork: TeamworkClient,
  tool: any,
  ALLOWED_PROJECTS: Array<{ id: number; name: string }>
) {
  return [
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
      async ({ startDate, endDate, projectId }: { startDate: string; endDate: string; projectId?: string }) => {
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
      async ({ projectId }: { projectId: number | string }) => {
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
      async ({ projectId, query }: { projectId: number | string; query: string }) => {
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
  ];
}
