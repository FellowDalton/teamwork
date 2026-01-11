// lib/handlers/chart.ts
// Chart request handler - Generate specific chart visualizations

import type { TeamworkClient } from "../teamwork_api_client/index.ts";
import { corsHeaders } from '../utils/response.ts';

export interface ChartRequestBody {
  chartType: string;
  projectId?: number;
}

export async function handleChartRequest(
  body: ChartRequestBody,
  teamwork: TeamworkClient
) {
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
