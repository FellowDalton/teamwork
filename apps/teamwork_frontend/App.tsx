import React, { useState, useEffect, useCallback } from "react";
import { Project, Stage, Task } from "./types";
import {
  ChatMessage,
  ConversationTopic,
  DisplayData,
  DisplayItem,
  TaskDisplayData,
  TimelogDisplayData,
  MetricDisplayData,
  ProjectSummaryData,
} from "./types/conversation";
import { AnalogButton } from "./components/AnalogButton";
import { ConversationPanel } from "./components/ConversationPanel";
import { DataDisplayPanel } from "./components/DataDisplayPanel";
import { processChatCommand, processStreamingChat, processAgentStream, VisualizationSpec } from "./services/claudeService";
import { teamworkService, TeamworkTask, TeamworkTimeEntry } from "./services/teamworkService";
import {
  Layout,
  Plus,
  Bell,
  Briefcase,
  Settings,
  Sun,
  Moon,
  BarChart3,
  Clock,
  Grid,
  Loader2,
} from "lucide-react";

// Transform Teamwork API data to frontend format
function transformTeamworkData(
  apiTasks: TeamworkTask[],
  stages: Array<{ id: number; name: string }>,
  timeEntries: TeamworkTimeEntry[]
): Stage[] {
  // Group tasks by workflow column (stage)
  const stageMap = new Map<string, Task[]>();
  
  // Initialize stages
  for (const stage of stages) {
    stageMap.set(stage.name, []);
  }
  // Add a default stage for tasks without workflow column
  if (!stageMap.has("Backlog")) {
    stageMap.set("Backlog", []);
  }

  // Transform and group tasks
  for (const apiTask of apiTasks) {
    const stageName = apiTask.workflowColumn?.name || "Backlog";
    if (!stageMap.has(stageName)) {
      stageMap.set(stageName, []);
    }

    // Find time entries for this task
    const taskTimelogs = timeEntries
      .filter((te) => te.taskId === apiTask.id)
      .map((te) => ({
        id: `tl-${te.id}`,
        hours: te.minutes / 60,
        date: te.date,
        isBillable: te.isBillable ?? true,
        comment: te.description || "",
      }));

    const task: Task = {
      id: `task-${apiTask.id}`,
      title: apiTask.name,
      description: apiTask.description,
      priority: (apiTask.priority as "low" | "medium" | "high") || "medium",
      tags: apiTask.tags?.map((t) => t.name || "").filter(Boolean) || [],
      assignedTo: `https://picsum.photos/seed/${apiTask.id}/32/32`,
      timeLogs: taskTimelogs,
      comments: [],
    };

    stageMap.get(stageName)!.push(task);
  }

  // Convert to Stage array
  const result: Stage[] = [];
  let stageIdx = 0;
  for (const [name, tasks] of stageMap) {
    if (tasks.length > 0 || stages.some((s) => s.name === name)) {
      result.push({
        id: `stage-${stageIdx++}`,
        name,
        tasks,
      });
    }
  }

  return result;
}

type Theme = "light" | "dark";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Cache for time entries by project
  const [timeEntriesCache, setTimeEntriesCache] = useState<Map<number, TeamworkTimeEntry[]>>(new Map());

  // Conversation state
  const [activeTopic, setActiveTopic] = useState<ConversationTopic>("general");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string>("");

  // Data display state
  const [displayData, setDisplayData] = useState<DisplayData | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const isLight = theme === "light";

  // Fetch project list on mount (without details)
  const loadProjectList = useCallback(async () => {
    setIsLoadingProjects(true);
    setApiError(null);
    
    try {
      const apiProjects = await teamworkService.getProjects();
      
      // Create project entries without full details (stages will be loaded when selected)
      const transformedProjects: Project[] = apiProjects.map((apiProject) => ({
        id: `proj-${apiProject.id}`,
        name: apiProject.name,
        description: apiProject.description || "",
        stages: [], // Will be loaded when project is selected
        lastUpdated: apiProject.updatedAt || new Date().toISOString(),
      }));
      
      setProjects(transformedProjects);
      
      // Auto-select first project
      if (transformedProjects.length > 0 && !activeProjectId) {
        setActiveProjectId(transformedProjects[0].id);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setApiError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setIsLoadingProjects(false);
    }
  }, [activeProjectId]);

  // Load project details when a project is selected
  const loadProjectDetails = useCallback(async (projectId: string) => {
    const numericId = parseInt(projectId.replace("proj-", ""));
    if (isNaN(numericId)) return;
    
    try {
      const details = await teamworkService.getProject(numericId);
      const timeEntries = await teamworkService.getTimeEntries(numericId);
      
      // Cache time entries
      setTimeEntriesCache((prev) => new Map(prev).set(numericId, timeEntries));
      
      const stages = transformTeamworkData(details.tasks, details.stages, timeEntries);
      
      // Update the project with full details
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, stages, description: details.project.description || p.description }
            : p
        )
      );
    } catch (err) {
      console.error(`Failed to load project details for ${projectId}:`, err);
    }
  }, []);

  // Load project list on mount
  useEffect(() => {
    loadProjectList();
  }, []);

  // Load details when active project changes
  useEffect(() => {
    if (activeProjectId) {
      loadProjectDetails(activeProjectId);
    }
  }, [activeProjectId, loadProjectDetails]);

  // Reset conversation when topic changes
  useEffect(() => {
    // Add welcome message for topic
    const welcomeMessages: Record<ConversationTopic, string> = {
      project:
        "Project creation mode active. Describe the project you want to create and I'll generate the structure.",
      status: `Status mode active. I can show you project metrics, task progress, and summaries for ${
        activeProject?.name || "your projects"
      }.`,
      timelog: `Time log mode active. Log hours with commands like "log 2 hours on [task name]" or ask to see recent time entries.`,
      general: "I can help you track time, check project status, and manage tasks. Select a project from the sidebar or ask me anything.",
    };

    const welcomeMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: welcomeMessages[activeTopic],
      timestamp: new Date().toISOString(),
      topic: activeTopic,
    };

    setMessages([welcomeMsg]);
    setDisplayData(null);
  }, [activeTopic]);

  // --- Theme Styles ---
  const appBg = isLight ? "bg-[#e4e4e7]" : "bg-[#121214]";
  const appText = isLight ? "text-zinc-800" : "text-zinc-100";
  const headerBg = isLight
    ? "bg-[#d4d4d8] border-zinc-400"
    : "bg-[#18181b] border-black";
  const logoBg = isLight
    ? "bg-[#e4e4e7] border-zinc-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
    : "bg-[#27272a] border-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]";
  const dividerBg = isLight ? "bg-zinc-400" : "bg-zinc-800";
  const sidebarBg = isLight
    ? "bg-[#d4d4d8] border-zinc-400"
    : "bg-[#18181b] border-black";
  const sidebarHeading = isLight ? "text-zinc-500" : "text-zinc-600";
  const sidebarFooterBorder = isLight ? "border-zinc-400" : "border-zinc-800";
  const lcdBg = isLight
    ? "bg-[#e4e4e7] border-zinc-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"
    : "bg-[#0c0c0e] border-zinc-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]";
  const lcdLabel = isLight ? "text-cyan-700" : "text-cyan-600";
  const lcdText = isLight ? "text-zinc-800" : "text-cyan-400";

  // --- Handlers ---

  const handleTopicChange = (topic: ConversationTopic) => {
    // If clicking the same topic, toggle back to general
    if (activeTopic === topic && topic !== "general") {
      setActiveTopic("general");
    } else {
      setActiveTopic(topic);
    }
  };

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      topic: activeTopic,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsProcessing(true);

    try {
      // Use streaming chat - show status while processing
      let receivedText = "";
      let streamedContent = "";
      setThinkingStatus("");
      // Get numeric project ID if a project is selected
      const numericProjectId = activeProjectId 
        ? parseInt(activeProjectId.replace("proj-", "")) 
        : undefined;
      
      // Use Agent SDK with skills (sequential: Main Agent → Viz Agent)
      // Switch to processStreamingChat for legacy CLI-based flow
      await processAgentStream({
        message: content,
        topic: activeTopic,
        projectId: numericProjectId,
        projectName: activeProject?.name,
        onChunk: (text) => {
          receivedText = text;
          // For streaming chunks, accumulate and update the message
          streamedContent = text;
        },
        onThinking: (thinking) => {
          // Show thinking status in the processing indicator
          setThinkingStatus(thinking);
        },
        onCards: (cardData) => {
          // CardAgent returned structured card data - display it
          const items: DisplayItem[] = cardData.cards.map((card) => ({
            id: card.id,
            type: "timelog" as const,
            data: {
              timelog: {
                id: card.id,
                hours: card.hours,
                comment: card.description || "",
                isBillable: true,
                date: card.date,
              },
              taskTitle: card.taskName,
              projectName: card.projectName,
            } as TimelogDisplayData,
          }));
          
          // Add summary card
          items.push({
            id: "metric-summary",
            type: "metric",
            data: {
              label: "Total Hours",
              value: `${cardData.summary.totalHours.toFixed(1)}h`,
              subValue: `${cardData.summary.totalEntries} entries · ${cardData.summary.totalTasks} tasks`,
              color: "green",
            } as MetricDisplayData,
          });
          
          setDisplayData({
            type: "activity",
            title: "Activity Status",
            subtitle: cardData.summary.periodLabel || "Recent Activity",
            items,
          });
        },
        onVisualization: (spec) => {
          // Creative visualization agent returned a visualization spec
          console.log("Visualization spec received:", spec);
          const items: DisplayItem[] = [];
          
          if (spec.type === "summary") {
            // Summary visualization - show metrics
            if (spec.metrics) {
              for (const metric of spec.metrics) {
                items.push({
                  id: `metric-${metric.label}`,
                  type: "metric",
                  data: {
                    label: metric.label,
                    value: metric.value,
                    color: metric.emphasis ? "green" : "blue",
                  } as MetricDisplayData,
                });
              }
            }
            // Add breakdown if present
            if (spec.breakdown) {
              for (const item of spec.breakdown) {
                items.push({
                  id: `breakdown-${item.label}`,
                  type: "metric",
                  data: {
                    label: item.label,
                    value: `${item.hours.toFixed(1)}h`,
                    subValue: `${item.percentage}%`,
                    color: "cyan",
                  } as MetricDisplayData,
                });
              }
            }
            setDisplayData({
              type: "status",
              title: spec.title || "Summary",
              subtitle: spec.summary ? `${spec.summary.totalEntries} entries` : "",
              items,
            });
          } else if (spec.type === "cards" && spec.items) {
            // Activity cards
            for (const item of spec.items.slice(0, 15)) {
              items.push({
                id: item.id || `card-${item.date}-${item.taskName}`,
                type: "timelog",
                data: {
                  timelog: {
                    id: item.id,
                    hours: item.hours,
                    comment: item.description || "",
                    isBillable: true,
                    date: item.date,
                  },
                  taskTitle: item.taskName,
                  projectName: item.projectName,
                } as TimelogDisplayData,
              });
            }
            // Add summary at bottom
            if (spec.summary) {
              items.push({
                id: "metric-total",
                type: "metric",
                data: {
                  label: "Total Hours",
                  value: `${spec.summary.totalHours?.toFixed(1) || 0}h`,
                  subValue: `${spec.summary.totalEntries || 0} entries · ${spec.summary.totalTasks || 0} tasks`,
                  color: "green",
                } as MetricDisplayData,
              });
            }
            setDisplayData({
              type: "activity",
              title: spec.title || "Activity",
              subtitle: "",
              items,
            });
          } else if (spec.type === "chart" && spec.data) {
            // Chart visualization - for now show as metrics until we add chart component
            for (const point of spec.data) {
              items.push({
                id: `chart-${point.label}`,
                type: "metric",
                data: {
                  label: point.label,
                  value: `${point.value.toFixed(1)}h`,
                  color: "cyan",
                } as MetricDisplayData,
              });
            }
            if (spec.summary) {
              items.push({
                id: "chart-total",
                type: "metric",
                data: {
                  label: "Total",
                  value: `${spec.summary.total?.toFixed(1) || 0}h`,
                  subValue: spec.summary.average ? `Avg: ${spec.summary.average.toFixed(1)}h` : "",
                  color: "green",
                } as MetricDisplayData,
              });
            }
            setDisplayData({
              type: "status",
              title: spec.title || "Chart",
              subtitle: spec.chartType || "",
              items,
            });
          }
        },
        onComplete: (fullText) => {
          setThinkingStatus("");
          // Add the final assistant message when complete
          const aiMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: fullText || receivedText || "Done.",
            timestamp: new Date().toISOString(),
            topic: activeTopic,
          };
          setMessages((prev) => [...prev, aiMsg]);
          
          // Cards are now populated via onCards callback when Opus includes [[DISPLAY:cards]]
          // The CardAgent (Haiku) formats the data intelligently
          setIsProcessing(false);
        },
        onError: (error) => {
          console.error("Stream error:", error);
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: "System Error: Connection interrupted.",
            timestamp: new Date().toISOString(),
            topic: activeTopic,
          };
          setMessages((prev) => [...prev, errorMsg]);
          setIsProcessing(false);
        },
      });
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "System Error: Connection interrupted.",
        timestamp: new Date().toISOString(),
        topic: activeTopic,
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsProcessing(false);
    }
  };

  const handleToolCall = async (
    functionName: string,
    args: any,
    text?: string
  ) => {
    switch (functionName) {
      case "logWork": {
        const { taskName, hours, comment, isBillable } = args;
        const success = await handleLogWork(
          taskName,
          hours,
          comment,
          isBillable !== false
        );

        const responseMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: success
            ? `Logged ${hours}h ${
                isBillable !== false ? "[BILLABLE]" : "[NON-BILL]"
              } to "${taskName}".`
            : `Error: Task "${taskName}" not found.`,
          timestamp: new Date().toISOString(),
          topic: activeTopic,
        };
        setMessages((prev) => [...prev, responseMsg]);
        break;
      }

      case "createProject": {
        handleCreateProject(args);
        const responseMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `Project "${args.name}" created with ${
            args.stages?.length || 0
          } stages.`,
          timestamp: new Date().toISOString(),
          topic: activeTopic,
        };
        setMessages((prev) => [...prev, responseMsg]);
        break;
      }

      case "displayTasks": {
        handleDisplayTasks(args);
        const responseMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: text || `Displaying tasks in the data panel.`,
          timestamp: new Date().toISOString(),
          topic: activeTopic,
        };
        setMessages((prev) => [...prev, responseMsg]);
        break;
      }

      case "displayTimelogs": {
        handleDisplayTimelogs(args);
        const responseMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: text || `Displaying time logs in the data panel.`,
          timestamp: new Date().toISOString(),
          topic: activeTopic,
        };
        setMessages((prev) => [...prev, responseMsg]);
        break;
      }

      case "displayStatus": {
        handleDisplayStatus(args);
        const responseMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: text || `Displaying project status.`,
          timestamp: new Date().toISOString(),
          topic: activeTopic,
        };
        setMessages((prev) => [...prev, responseMsg]);
        break;
      }

      case "displayActivityStatus": {
        handleDisplayActivityStatus(args);
        const responseMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: text || `Displaying your activity status.`,
          timestamp: new Date().toISOString(),
          topic: activeTopic,
        };
        setMessages((prev) => [...prev, responseMsg]);
        break;
      }

      default: {
        const responseMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: text || "Command processed.",
          timestamp: new Date().toISOString(),
          topic: activeTopic,
        };
        setMessages((prev) => [...prev, responseMsg]);
      }
    }
  };

  const handleLogWork = async (
    taskName: string | undefined,
    hours: number,
    comment: string,
    isBillable: boolean
  ): Promise<boolean> => {
    let targetProject = activeProject;
    let targetTask: Task | null = null;
    let targetStage: Stage | null = null;

    const findTaskInProject = (proj: Project, name: string) => {
      for (const stage of proj.stages) {
        const task = stage.tasks.find((t) =>
          t.title.toLowerCase().includes(name.toLowerCase())
        );
        if (task) return { task, stage };
      }
      return null;
    };

    if (activeProject && taskName) {
      const found = findTaskInProject(activeProject, taskName);
      if (found) {
        targetTask = found.task;
        targetStage = found.stage;
      }
    } else if (!activeProject && taskName) {
      for (const proj of projects) {
        const found = findTaskInProject(proj, taskName);
        if (found) {
          targetTask = found.task;
          targetStage = found.stage;
          targetProject = proj;
          break;
        }
      }
    } else if (activeProject && !taskName) {
      if (activeProject.stages[0]?.tasks.length > 0) {
        targetTask = activeProject.stages[0].tasks[0];
        targetStage = activeProject.stages[0];
      }
    }

    if (targetTask && targetStage && targetProject) {
      // Extract numeric task ID from the task.id (format: "task-{number}")
      const taskIdMatch = targetTask.id.match(/task-(\d+)/);
      const numericTaskId = taskIdMatch ? parseInt(taskIdMatch[1]) : null;

      // Try to log to real API if we have a numeric task ID
      if (numericTaskId && activeProjectId) {
        try {
          await teamworkService.logTime(numericTaskId, hours, comment, isBillable);
          // Refresh the project data to show updated time entries
          loadProjectDetails(activeProjectId);
          return true;
        } catch (err) {
          console.error("Failed to log time to API:", err);
          // Fall through to local update
        }
      }

      // Local update (fallback or for mock tasks)
      const updatedTask = { ...targetTask };

      updatedTask.timeLogs = [
        ...(updatedTask.timeLogs || []),
        {
          id: `log-${Date.now()}`,
          hours,
          comment,
          isBillable,
          date: new Date().toISOString(),
        },
      ];

      updatedTask.comments = [
        ...(updatedTask.comments || []),
        {
          id: `cmt-${Date.now()}`,
          text: `Logged ${hours}h: ${comment}`,
          createdAt: new Date().toISOString(),
          author: "AI",
        },
      ];

      const updatedProject = {
        ...targetProject,
        stages: targetProject.stages.map((s) =>
          s.id === targetStage!.id
            ? {
                ...s,
                tasks: s.tasks.map((t) =>
                  t.id === updatedTask.id ? updatedTask : t
                ),
              }
            : s
        ),
      };

      setProjects((prev) =>
        prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
      );
      return true;
    }

    return false;
  };

  const handleCreateProject = (projectData: any) => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: projectData.name,
      description: projectData.description,
      stages:
        projectData.stages?.map((stage: any, sIdx: number) => ({
          id: `stage-${Date.now()}-${sIdx}`,
          name: stage.name,
          tasks:
            stage.tasks?.map((task: any, tIdx: number) => ({
              id: `task-${Date.now()}-${sIdx}-${tIdx}`,
              title: task.title,
              description: task.description,
              priority: task.priority || "medium",
              tags: task.tags || [],
              timeLogs: [],
              comments: [],
              assignedTo: `https://picsum.photos/seed/${Math.random()}/32/32`,
            })) || [],
        })) || [],
      lastUpdated: new Date().toISOString(),
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
  };

  const handleDisplayTasks = (args: {
    title: string;
    subtitle?: string;
    filter?: any;
  }) => {
    if (!activeProject) return;

    let tasks = activeProject.stages.flatMap((s) =>
      s.tasks.map((t) => ({ task: t, stageName: s.name }))
    );

    // Apply filters
    if (args.filter) {
      if (args.filter.priority) {
        tasks = tasks.filter((t) => t.task.priority === args.filter.priority);
      }
      if (args.filter.stageName) {
        tasks = tasks.filter((t) =>
          t.stageName
            .toLowerCase()
            .includes(args.filter.stageName.toLowerCase())
        );
      }
      if (args.filter.limit) {
        tasks = tasks.slice(0, args.filter.limit);
      }
    }

    const items: DisplayItem[] = tasks.map(({ task, stageName }) => ({
      id: task.id,
      type: "task" as const,
      data: { task, stageName } as TaskDisplayData,
    }));

    setDisplayData({
      type: "tasks",
      title: args.title,
      subtitle: args.subtitle || activeProject.name,
      items,
    });
  };

  const handleDisplayTimelogs = (args: {
    title: string;
    subtitle?: string;
    taskName?: string;
    limit?: number;
  }) => {
    if (!activeProject) return;

    let timelogs: { timelog: any; taskTitle: string; projectName: string }[] =
      [];

    for (const stage of activeProject.stages) {
      for (const task of stage.tasks) {
        if (
          args.taskName &&
          !task.title.toLowerCase().includes(args.taskName.toLowerCase())
        ) {
          continue;
        }
        for (const log of task.timeLogs) {
          timelogs.push({
            timelog: log,
            taskTitle: task.title,
            projectName: activeProject.name,
          });
        }
      }
    }

    // Sort by date (newest first)
    timelogs.sort(
      (a, b) =>
        new Date(b.timelog.date).getTime() - new Date(a.timelog.date).getTime()
    );

    if (args.limit) {
      timelogs = timelogs.slice(0, args.limit);
    }

    const items: DisplayItem[] = timelogs.map(
      ({ timelog, taskTitle, projectName }) => ({
        id: timelog.id,
        type: "timelog" as const,
        data: { timelog, taskTitle, projectName } as TimelogDisplayData,
      })
    );

    setDisplayData({
      type: "timelogs",
      title: args.title,
      subtitle:
        args.subtitle ||
        `${timelogs.reduce((acc, t) => acc + t.timelog.hours, 0)}h total`,
      items,
    });
  };

  const handleDisplayStatus = (args: {
    title: string;
    showMetrics?: boolean;
    showTasks?: boolean;
  }) => {
    if (!activeProject) return;

    const items: DisplayItem[] = [];

    // Calculate metrics
    const totalTasks = activeProject.stages.reduce(
      (acc, s) => acc + s.tasks.length,
      0
    );
    const totalHours = activeProject.stages
      .flatMap((s) => s.tasks)
      .reduce((acc, t) => acc + t.timeLogs.reduce((a, l) => a + l.hours, 0), 0);
    const billableHours = activeProject.stages
      .flatMap((s) => s.tasks)
      .reduce(
        (acc, t) =>
          acc +
          t.timeLogs
            .filter((l) => l.isBillable)
            .reduce((a, l) => a + l.hours, 0),
        0
      );
    const highPriorityTasks = activeProject.stages
      .flatMap((s) => s.tasks)
      .filter((t) => t.priority === "high").length;

    // Add metrics
    if (args.showMetrics !== false) {
      items.push({
        id: "metric-tasks",
        type: "metric",
        data: {
          label: "Total Tasks",
          value: totalTasks,
          color: "cyan",
        } as MetricDisplayData,
      });

      items.push({
        id: "metric-hours",
        type: "metric",
        data: {
          label: "Hours Logged",
          value: `${totalHours}h`,
          subValue: `${billableHours}h billable`,
          color: "green",
        } as MetricDisplayData,
      });

      items.push({
        id: "metric-priority",
        type: "metric",
        data: {
          label: "High Priority",
          value: highPriorityTasks,
          color: "red",
        } as MetricDisplayData,
      });

      // Stage breakdown
      activeProject.stages.forEach((stage) => {
        items.push({
          id: `metric-stage-${stage.id}`,
          type: "metric",
          data: {
            label: stage.name,
            value: stage.tasks.length,
            subValue: "tasks",
            color: "blue",
          } as MetricDisplayData,
        });
      });
    }

    setDisplayData({
      type: "status",
      title: args.title,
      subtitle: activeProject.name,
      items,
    });
  };

  const handleDisplayActivityStatus = async (args: {
    title: string;
    period?: string;
  }) => {
    try {
      const period = args.period || "today";
      const numericProjectId = activeProjectId 
        ? parseInt(activeProjectId.replace("proj-", "")) 
        : undefined;
      const params = new URLSearchParams({ period });
      if (numericProjectId) params.set('projectId', String(numericProjectId));
      const response = await fetch(`/api/activity-status?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch activity status");
      }
      const data = await response.json();

      const items: DisplayItem[] = [];

      // Add time entries as timelogs first
      for (const entry of data.timeEntries || []) {
        const taskName = data.included?.tasks?.[String(entry.taskId)]?.name || `Task #${entry.taskId}`;
        const projectName = data.included?.projects?.[String(entry.projectId)]?.name || `Project #${entry.projectId}`;
        items.push({
          id: `timelog-${entry.id}`,
          type: "timelog",
          data: {
            timelog: {
              id: entry.id,
              hours: entry.minutes / 60,
              comment: entry.description || "",
              isBillable: entry.billable,
              date: entry.timeLogged || entry.dateCreated,
            },
            taskTitle: taskName,
            projectName: projectName,
          } as TimelogDisplayData,
        });
      }

      // Add total hours summary at the bottom
      items.push({
        id: "metric-hours",
        type: "metric",
        data: {
          label: "Total Hours",
          value: `${data.summary.totalHours}h`,
          subValue: `${data.summary.entryCount} entries · ${data.summary.taskCount} task${data.summary.taskCount !== 1 ? 's' : ''}`,
          color: "green",
        } as MetricDisplayData,
      });

      setDisplayData({
        type: "activity",
        title: args.title,
        subtitle: `${data.user.name} - ${data.period.startDate} to ${data.period.endDate}`,
        items,
      });
    } catch (error) {
      console.error("Failed to fetch activity status:", error);
      // Show error in display
      setDisplayData({
        type: "status",
        title: "Error",
        subtitle: "Failed to load activity data",
        items: [],
      });
    }
  };

  // --- UI Components ---

  const getTopicLabel = () => {
    const labels: Record<ConversationTopic, string> = {
      project: "NEW PROJECT",
      status: "STATUS",
      timelog: "TIMELOG",
      general: "READY",
    };
    return labels[activeTopic];
  };

  return (
    <div
      className={`h-screen ${appBg} bg-noise ${appText} font-sans overflow-hidden flex flex-col transition-colors duration-300`}
    >
      {/* Top Hardware Panel */}
      <div
        className={`h-24 ${headerBg} border-b flex items-center px-6 gap-8 shadow-xl z-20 relative transition-colors duration-300`}
      >
        <div className="flex items-center gap-4">
          {/* Logo / Brand Area */}
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center border-b-4 ${logoBg}`}
          >
            <Layout className={isLight ? "text-zinc-500" : "text-zinc-400"} />
          </div>
          <div>
            <h1
              className={`font-bold text-lg tracking-tighter ${
                isLight ? "text-zinc-700" : "text-zinc-200"
              }`}
            >
              FELLOW
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
              AI Workflow Engine
            </p>
          </div>
        </div>

        <div className={`h-12 w-[2px] mx-4 ${dividerBg}`} />

        {/* Topic Controls */}
        <div className="flex gap-4 items-center">
          <div className="w-32">
            <AnalogButton
              label="PROJECT"
              isActive={activeTopic === "project"}
              onClick={() => handleTopicChange("project")}
              ledColor="purple"
              variant={activeTopic === "project" ? "accent" : "dark"}
              subLabel="Create"
              icon={<Plus size={14} />}
              theme={theme}
              noTexture
            />
          </div>
          <div className="w-28">
            <AnalogButton
              label="STATUS"
              isActive={activeTopic === "status"}
              onClick={() => handleTopicChange("status")}
              ledColor="cyan"
              variant="dark"
              subLabel="Overview"
              icon={<BarChart3 size={14} />}
              theme={theme}
              noTexture
            />
          </div>
          <div className="w-32">
            <AnalogButton
              label="TIMELOG"
              isActive={activeTopic === "timelog"}
              onClick={() => handleTopicChange("timelog")}
              ledColor="green"
              variant="dark"
              subLabel="Track"
              icon={<Clock size={14} />}
              theme={theme}
              noTexture
            />
          </div>
        </div>

        <div className={`h-12 w-[2px] mx-4 ${dividerBg}`} />

        {/* Status / Utility */}
        <div className="flex gap-4 items-center flex-1">
          <div className="flex-1"></div>

          {/* LCD Status Display */}
          <div
            className={`h-[60px] w-64 ${lcdBg} rounded flex flex-col p-2 font-mono relative overflow-hidden`}
          >
            <div className="flex justify-between items-center z-10 relative">
              <span
                className={`text-[10px] uppercase tracking-widest ${lcdLabel}`}
              >
                MODE
              </span>
              <div className="flex gap-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isProcessing ? "bg-amber-500 animate-pulse" : "bg-green-500"
                  }`}
                ></div>
              </div>
            </div>
            <div className={`text-xs mt-1 truncate ${lcdText}`}>
              {isProcessing
                ? "PROCESSING..."
                : `${getTopicLabel()} • ${activeProject?.name || "NO PROJECT"}`}
            </div>
            {/* Scanline overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-50"></div>
          </div>

          {/* Small Utility Buttons */}
          <div className="grid grid-cols-2 gap-[2px] w-[60px] h-[60px]">
            <div className="w-[29px] h-[29px]">
              <AnalogButton
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                icon={theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}
                variant="dark"
                theme={theme}
                minimal
                flush
                noTexture
                className={`!p-0 h-full ${
                  theme === "dark" ? "!text-yellow-400" : "!text-orange-500"
                }`}
              />
            </div>
            <div className="w-[29px] h-[29px]">
              <AnalogButton
                onClick={() => {}}
                icon={<Bell size={12} />}
                variant="dark"
                theme={theme}
                minimal
                flush
                noTexture
                className="!p-0 h-full hover:!text-red-400"
              />
            </div>
            <div className="w-[29px] h-[29px]">
              <AnalogButton
                onClick={() => {}}
                icon={<Settings size={12} />}
                variant="dark"
                theme={theme}
                minimal
                flush
                noTexture
                className="!p-0 h-full hover:!text-emerald-400"
              />
            </div>
            <div className="w-[29px] h-[29px]">
              <AnalogButton
                onClick={() => handleTopicChange("general")}
                icon={<Grid size={12} />}
                variant="dark"
                theme={theme}
                minimal
                flush
                noTexture
                isActive={activeTopic === "general"}
                className="!p-0 h-full hover:!text-blue-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`w-64 ${sidebarBg} flex flex-col border-r z-10 transition-colors duration-300 relative`}
        >
          <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
            <h2
              className={`text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${sidebarHeading}`}
            >
              <Briefcase size={12} /> Projects
            </h2>
            <div className="space-y-4">
              {projects.map((proj, idx) => (
                <AnalogButton
                  key={proj.id}
                  label={proj.name}
                  subLabel={`IDX_0${idx + 1}`}
                  isActive={activeProjectId === proj.id}
                  onClick={() => setActiveProjectId(activeProjectId === proj.id ? "" : proj.id)}
                  ledColor={activeProjectId === proj.id ? "orange" : "blue"}
                  variant={activeProjectId === proj.id ? "accent" : "dark"}
                  theme={theme}
                  noTexture
                />
              ))}
            </div>
          </div>

          <div className={`p-4 border-t ${sidebarFooterBorder}`}>
            <div
              className={`flex items-center gap-3 text-xs ${
                isLight ? "text-zinc-500" : "text-zinc-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                  isLight
                    ? "bg-zinc-200 border-zinc-300"
                    : "bg-zinc-800 border-zinc-700"
                }`}
              >
                <span className="font-bold">JS</span>
              </div>
              <div>
                <div className="font-bold">John Smith</div>
                <div className="opacity-70">Admin Access</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div
          className={`flex-1 relative flex flex-col overflow-hidden transition-colors duration-300`}
        >
          {/* Screen Glare overlay */}
          <div
            className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b pointer-events-none z-0 ${
              isLight
                ? "from-white/40 to-transparent"
                : "from-white/5 to-transparent"
            }`}
          ></div>

          {/* Two-Panel Layout */}
          <div className="flex-1 relative z-10 p-6 flex gap-6 overflow-hidden">
            {/* Left: Conversation Panel */}
            <div className="flex-1 min-w-0 h-full">
              <ConversationPanel
                messages={messages}
                onSend={handleSendMessage}
                topic={activeTopic}
                isProcessing={isProcessing}
                thinkingStatus={thinkingStatus}
                inputValue={inputValue}
                onInputChange={setInputValue}
                projectName={activeProject?.name}
                theme={theme}
              />
            </div>

            {/* Right: Data Display Panel */}
            <div className="flex-1 min-w-0 h-full">
              <DataDisplayPanel data={displayData} theme={theme} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
