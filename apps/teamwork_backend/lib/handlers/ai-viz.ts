// lib/handlers/ai-viz.ts
// AI Visualization request handler - custom prompts for visualizations

import type { TeamworkClient } from "../teamwork_api_client/index.ts";
import { corsHeaders } from '../utils/response.ts';
import { parseDateRange } from '../utils/date-parsing.ts';
import { runVisualizationAgent } from '../agents/visualization.ts';

export interface VisualizeRequestBody {
  prompt: string;
  projectId?: number;
}

export interface VisualizeRequestDependencies {
  query: any;
  claudeCodePath: string | undefined;
  agentSdkAvailable: boolean;
}

export async function handleVisualizeRequest(
  body: VisualizeRequestBody,
  teamwork: TeamworkClient,
  deps: VisualizeRequestDependencies
) {
  const { prompt, projectId } = body;
  const { query, claudeCodePath, agentSdkAvailable } = deps;

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

        // Parse date range from prompt (async - uses LLM for complex queries)
        const dateRange = await parseDateRange(prompt, query, claudeCodePath, agentSdkAvailable);

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
        const vizSpecs = await runVisualizationAgent(
          {
            question: prompt,
            data: timeData,
            periodLabel: dateRange.label,
          },
          query,
          claudeCodePath
        );

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
