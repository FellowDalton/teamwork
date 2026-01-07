import React, { useState, useEffect, useCallback } from "react";
import { Project, Stage, Task } from "./types";
import { apiUrl } from "./services/apiConfig";
import {
  ChatMessage,
  ConversationTopic,
  DisplayData,
  DisplayItem,
  TaskDisplayData,
  TimelogDisplayData,
  MetricDisplayData,
  ProjectSummaryData,
  ProjectDraftData,
  TasklistDraft,
  TaskDraft,
} from "./types/conversation";
import { AnalogButton } from "./components/AnalogButton";
import { ConversationPanel } from "./components/ConversationPanel";
import { DataDisplayPanel } from "./components/DataDisplayPanel";
// ConversationSelector is now rendered inside ConversationPanel
import { LoginButton, UserMenu } from "./components/LoginButton";
import { LoginScreen } from "./components/LoginScreen";
import SettingsModal from "./components/SettingsModal";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { processChatCommand, processStreamingChat, processAgentStream, requestAdditionalChart, VisualizationSpec, TimelogDraftData, TimelogDraftEntry, submitTimelogEntries, submitProject } from "./services/claudeService";
import { teamworkService, TeamworkTask, TeamworkTimeEntry } from "./services/teamworkService";
import * as supabaseService from "./services/supabaseService";
import type { Conversation } from "./types/supabase";
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

// Main app content - separated to use auth context
function AppContent() {
  const { isAuthenticated, isConfigured, isLoading: isAuthLoading, profile } = useAuth();

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

  // Supabase conversation persistence
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  // Data display state
  const [displayData, setDisplayData] = useState<DisplayData | null>(null);
  const [isChartLoading, setIsChartLoading] = useState(false);

  // Timelog draft state
  const [timelogDraft, setTimelogDraft] = useState<TimelogDraftData | null>(null);
  const [isSubmittingTimelog, setIsSubmittingTimelog] = useState(false);

  // Project draft state
  const [projectDraft, setProjectDraft] = useState<ProjectDraftData | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(() => {
    const saved = localStorage.getItem('hourlyRate');
    return saved ? parseInt(saved, 10) : 1200;
  });

  // Persist hourly rate to localStorage
  useEffect(() => {
    localStorage.setItem('hourlyRate', hourlyRate.toString());
  }, [hourlyRate]);

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
    // Clear current conversation so a new one is created for this topic
    setCurrentConversation(null);

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
    setTimelogDraft(null); // Clear any draft when switching topics
    setProjectDraft(null);
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

  // File attachment state for create project
  const [attachedFiles, setAttachedFiles] = useState<import('./types/conversation').FileAttachment[]>([]);

  // --- Conversation Persistence Handlers ---

  // Handle selecting an existing conversation from the dropdown
  const handleSelectConversation = useCallback(async (conversation: Conversation | null) => {
    if (!conversation) {
      // Starting fresh - clear current conversation
      setCurrentConversation(null);
      setMessages([]);
      setDisplayData(null);
      return;
    }

    setCurrentConversation(conversation);
    setActiveTopic(conversation.topic);

    // Load messages from Supabase
    const convWithMessages = await supabaseService.getConversationWithMessages(conversation.id);
    if (convWithMessages?.messages) {
      const loadedMessages: ChatMessage[] = convWithMessages.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content || '',
        timestamp: msg.created_at,
        topic: conversation.topic,
        displayData: msg.display_data as DisplayData | undefined,
      }));
      setMessages(loadedMessages);
    }
  }, []);

  // Handle creating a new conversation
  const handleNewConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation);
    setActiveTopic(conversation.topic);
    setMessages([]);
    setDisplayData(null);
    setTimelogDraft(null);
    setProjectDraft(null);
  }, []);

  // Save message to Supabase (called after each message exchange)
  const persistMessage = useCallback(async (
    role: 'user' | 'assistant',
    content: string,
    displayData?: DisplayData
  ) => {
    if (!isAuthenticated || !currentConversation) return;

    try {
      await supabaseService.addMessage(
        currentConversation.id,
        role,
        content,
        displayData as Record<string, unknown>
      );

      // Generate title from first user message
      if (role === 'user' && !currentConversation.title) {
        await supabaseService.generateConversationTitle(currentConversation.id, content);
      }
    } catch (error) {
      console.error('Failed to persist message:', error);
    }
  }, [isAuthenticated, currentConversation]);

  // --- Handlers ---

  const handleTopicChange = (topic: ConversationTopic) => {
    // If clicking the same topic, toggle back to general
    if (activeTopic === topic && topic !== "general") {
      setActiveTopic("general");
    } else {
      setActiveTopic(topic);
      // Deselect project when entering "create new project" mode
      if (topic === "project") {
        setActiveProjectId("");
      }
    }
    // Clear attached files when switching topics
    setAttachedFiles([]);
  };

  // Handle chart request from dropdown options
  const handleRequestChart = async (chartType: string) => {
    if (!activeProjectId) return;
    
    setIsChartLoading(true);
    const numericProjectId = parseInt(activeProjectId.replace('proj-', ''));
    
    await requestAdditionalChart({
      chartType,
      projectId: numericProjectId,
      onVisualization: (spec) => {
        console.log("Additional chart received:", spec);
        
        setDisplayData((prev) => {
          const newItems: DisplayItem[] = prev?.items ? [...prev.items] : [];
          
          if (spec.type === "chart") {
            newItems.push({
              id: `chart-${chartType}-${Date.now()}`,
              type: "chart",
              data: {
                chartType: spec.chartType || "bar",
                title: spec.title || chartType,
                data: spec.data || [],
                summary: spec.summary,
              },
            });
          } else if (spec.type === "summary" && spec.metrics) {
            for (const metric of spec.metrics) {
              newItems.push({
                id: `metric-${metric.label}-${Date.now()}`,
                type: "metric",
                data: {
                  label: metric.label,
                  value: metric.value,
                  color: metric.emphasis ? "green" : "blue",
                } as MetricDisplayData,
              });
            }
          }
          
          return {
            type: prev?.type || "status",
            title: prev?.title || "Data Display",
            subtitle: prev?.subtitle,
            items: newItems,
          };
        });
      },
      onError: (error) => {
        console.error("Chart request error:", error);
      },
      onComplete: () => {
        setIsChartLoading(false);
      },
    });
  };

  // --- Timelog Draft Handlers ---
  
  const handleTimelogDraftUpdate = (id: string, updates: Partial<TimelogDraftEntry>) => {
    if (!timelogDraft) return;
    
    setTimelogDraft({
      ...timelogDraft,
      entries: timelogDraft.entries.map(entry =>
        entry.id === id ? { ...entry, ...updates } : entry
      ),
      summary: {
        ...timelogDraft.summary,
        totalHours: timelogDraft.entries.reduce((sum, entry) => {
          if (entry.id === id && updates.hours !== undefined) {
            return sum + updates.hours;
          }
          return sum + entry.hours;
        }, 0),
      },
    });
  };
  
  const handleTimelogDraftRemove = (id: string) => {
    if (!timelogDraft) return;
    
    const updatedEntries = timelogDraft.entries.filter(entry => entry.id !== id);
    
    if (updatedEntries.length === 0) {
      setTimelogDraft(null);
      return;
    }
    
    setTimelogDraft({
      ...timelogDraft,
      entries: updatedEntries,
      summary: {
        ...timelogDraft.summary,
        totalHours: updatedEntries.reduce((sum, entry) => sum + entry.hours, 0),
        totalEntries: updatedEntries.length,
      },
    });
  };
  
  const handleTimelogDraftSubmit = async () => {
    if (!timelogDraft || timelogDraft.entries.length === 0) return;
    
    setIsSubmittingTimelog(true);
    
    try {
      const result = await submitTimelogEntries(
        timelogDraft.entries.map(entry => ({
          taskId: entry.taskId,
          hours: entry.hours,
          date: entry.date,
          comment: entry.comment,
        }))
      );
      
      // Clear the draft
      setTimelogDraft(null);
      
      // Add success message to chat
      const successMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: result.message,
        timestamp: new Date().toISOString(),
        topic: "timelog",
      };
      setMessages(prev => [...prev, successMsg]);
      
    } catch (error) {
      console.error("Failed to submit time entries:", error);
      
      // Add error message to chat
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `Failed to submit time entries: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
        topic: "timelog",
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSubmittingTimelog(false);
    }
  };

  // --- Project Draft Submit Handler ---
  const handleProjectDraftSubmit = async () => {
    if (!projectDraft) return;
    
    setIsCreatingProject(true);
    
    try {
      const result = await submitProject({
        project: projectDraft.project,
        tasklists: projectDraft.tasklists,
        budget: projectDraft.budget,
      });
      
      // Mark the draft as created (keep it visible with success state)
      setProjectDraft({
        ...projectDraft,
        isCreated: true,
        createdProjectUrl: result.projectUrl,
      });
      
      // Add success message to chat
      const successMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: result.message + (result.projectUrl ? `\n\n[View Project](${result.projectUrl})` : ''),
        timestamp: new Date().toISOString(),
        topic: "project",
      };
      setMessages(prev => [...prev, successMsg]);
      
      // Refresh project list to show new project
      await loadProjectList();
      
    } catch (error) {
      console.error("Failed to create project:", error);
      
      // Add error message to chat
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `Failed to create project: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
        topic: "project",
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsCreatingProject(false);
    }
  };
  
  // --- Project Draft Update Handlers ---
  const handleProjectTasklistUpdate = (tasklistId: string, updates: Partial<TasklistDraft>) => {
    if (!projectDraft) return;
    setProjectDraft({
      ...projectDraft,
      tasklists: projectDraft.tasklists.map(tl =>
        tl.id === tasklistId ? { ...tl, ...updates } : tl
      ),
    });
  };
  
  const handleProjectTaskUpdate = (tasklistId: string, taskId: string, updates: Partial<TaskDraft>) => {
    if (!projectDraft) return;
    setProjectDraft({
      ...projectDraft,
      tasklists: projectDraft.tasklists.map(tl =>
        tl.id === tasklistId
          ? {
              ...tl,
              tasks: tl.tasks.map(task =>
                task.id === taskId ? { ...task, ...updates } : task
              ),
            }
          : tl
      ),
    });
  };

  // Handle custom visualization request from input - sends prompt to AI for interpretation
  const handleVisualizationRequest = async (prompt: string) => {
    console.log("Visualization request:", prompt);
    setIsChartLoading(true);
    
    const numericProjectId = activeProjectId 
      ? parseInt(activeProjectId.replace('proj-', '')) 
      : undefined;

    try {
      const response = await fetch(apiUrl("/api/agent/visualize"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          projectId: numericProjectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Visualization request error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          
          if (data === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'visualization' && parsed.spec) {
              // Replace with new visualization (don't accumulate for custom requests)
              setDisplayData((prev) => {
                const newItems: DisplayItem[] = [];
                
                if (parsed.spec.type === "chart" && parsed.spec.data) {
                  newItems.push({
                    id: `chart-${parsed.spec.title || 'main'}-${Date.now()}`,
                    type: "chart",
                    data: {
                      chartType: parsed.spec.chartType || "bar",
                      title: parsed.spec.title || "Chart",
                      data: parsed.spec.data,
                      summary: parsed.spec.summary,
                    },
                  });
                } else if (parsed.spec.type === "custom" && parsed.spec.svg) {
                  // Custom AI-generated SVG visualization
                  newItems.push({
                    id: `custom-${parsed.spec.title || 'viz'}-${Date.now()}`,
                    type: "custom",
                    data: {
                      title: parsed.spec.title || "Custom Visualization",
                      svg: parsed.spec.svg,
                      description: parsed.spec.description,
                    },
                  });
                } else if (parsed.spec.type === "summary" && parsed.spec.metrics) {
                  for (const metric of parsed.spec.metrics) {
                    newItems.push({
                      id: `metric-${metric.label}-${Date.now()}`,
                      type: "metric",
                      data: {
                        label: metric.label,
                        value: metric.value,
                        color: metric.emphasis ? "green" : "blue",
                      } as MetricDisplayData,
                    });
                  }
                }
                
                return {
                  type: prev?.type || "status",
                  title: parsed.spec.title || prev?.title || "Visualization",
                  subtitle: prev?.subtitle,
                  items: newItems,
                };
              });
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (error) {
      console.error("Visualization request error:", error);
    } finally {
      setIsChartLoading(false);
    }
  };

  const handleSendMessage = async (content: string, files?: import('./types/conversation').FileAttachment[]) => {
    // Build message content including file contents
    let fullContent = content;
    if (files && files.length > 0) {
      const fileContents = files
        .filter(f => f.content)
        .map(f => `\n\n--- File: ${f.name} ---\n${f.content}`)
        .join('\n');
      if (fileContents) {
        fullContent = `${content}\n\n[Attached Files]${fileContents}`;
      }
    }

    // Auto-create conversation on first message if authenticated and none exists
    let activeConversation = currentConversation;
    if (isAuthenticated && !activeConversation) {
      const newConv = await supabaseService.createConversation(
        activeTopic,
        activeProjectId ? activeProjectId.replace('proj-', '') : undefined
      );
      if (newConv) {
        activeConversation = newConv;
        setCurrentConversation(newConv);
      }
    }

    // Add user message (show original content, not the file dump)
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: files && files.length > 0
        ? `${content}\n\n📎 ${files.length} file(s) attached: ${files.map(f => f.name).join(', ')}`
        : content,
      timestamp: new Date().toISOString(),
      topic: activeTopic,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setAttachedFiles([]); // Clear files after sending
    setIsProcessing(true);
    setDisplayData(null); // Clear previous visualizations
    setTimelogDraft(null); // Clear any previous draft

    // Persist user message to Supabase
    if (isAuthenticated && activeConversation) {
      await supabaseService.addMessage(activeConversation.id, 'user', fullContent);
      // Generate title from first message if no title yet
      if (!activeConversation.title) {
        supabaseService.generateConversationTitle(activeConversation.id, content);
      }
    }

    try {
      // Use streaming chat - show status while processing
      let receivedText = "";
      let streamedContent = "";
      let accumulatedThinking = "";
      setThinkingStatus("");
      // Get numeric project ID if a project is selected
      const numericProjectId = activeProjectId 
        ? parseInt(activeProjectId.replace("proj-", "")) 
        : undefined;
      
      // Use Agent SDK with skills (sequential: Main Agent → Viz Agent)
      // Switch to processStreamingChat for legacy CLI-based flow
      await processAgentStream({
        message: fullContent,
        topic: activeTopic,
        projectId: numericProjectId,
        projectName: activeProject?.name,
        onChunk: (text) => {
          receivedText = text;
          // For streaming chunks, accumulate and update the message
          streamedContent = text;
        },
        onThinking: (thinking) => {
          // Accumulate thinking text so user can see the full stream
          accumulatedThinking += thinking;
          setThinkingStatus(accumulatedThinking);
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
          // Creative visualization agent - can send multiple specs
          // ACCUMULATE items from all visualization specs
          console.log("Visualization spec received:", spec);
          
          setDisplayData((prev) => {
            const newItems: DisplayItem[] = prev?.items ? [...prev.items] : [];
            
            if (spec.type === "summary") {
              // Summary visualization - show metrics
              if (spec.metrics) {
                for (const metric of spec.metrics) {
                  newItems.push({
                    id: `metric-${metric.label}-${Date.now()}`,
                    type: "metric",
                    data: {
                      label: metric.label,
                      value: metric.value,
                      color: metric.emphasis ? "green" : "blue",
                    } as MetricDisplayData,
                  });
                }
              }
            } else if (spec.type === "cards" && spec.items) {
              // Activity cards
              for (const item of spec.items.slice(0, 15)) {
                newItems.push({
                  id: item.id || `card-${item.date}-${item.taskName}-${Date.now()}`,
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
              // Add summary
              if (spec.summary) {
                newItems.push({
                  id: `metric-total-${Date.now()}`,
                  type: "metric",
                  data: {
                    label: "Total Hours",
                    value: `${spec.summary.totalHours?.toFixed(1) || 0}h`,
                    subValue: `${spec.summary.totalEntries || 0} entries · ${spec.summary.totalTasks || 0} tasks`,
                    color: "green",
                  } as MetricDisplayData,
                });
              }
            } else if (spec.type === "chart" && spec.data) {
              // Chart visualization
              newItems.push({
                id: `chart-${spec.title || 'main'}-${Date.now()}`,
                type: "chart",
                data: {
                  chartType: spec.chartType || "bar",
                  title: spec.title || "Chart",
                  data: spec.data,
                  summary: spec.summary,
                },
              });
            }
            
            return {
              type: "status",
              title: spec.title || prev?.title || "Data",
              subtitle: "",
              items: newItems,
            };
          });
        },
        onTimelogDraft: (draft) => {
          // Timelog agent returned draft entries for review
          console.log("Timelog draft received:", draft.entries.length, "entries");
          setTimelogDraft(draft);
        },
        onProjectDraft: (draft) => {
          // Project agent returned draft project structure for review
          console.log("Project draft received:", draft.summary.totalTasks, "tasks");
          setProjectDraft(draft);
        },
        onProjectDraftUpdate: (update) => {
          // Progressive update - accumulate into existing draft
          console.log("Project draft update:", update.action);
          setProjectDraft((prev) => {
            if (!prev) return prev;

            switch (update.action) {
              case 'add_tasklist':
                if (update.tasklist) {
                  return {
                    ...prev,
                    tasklists: [...prev.tasklists, { ...update.tasklist, tasks: [] }],
                    summary: {
                      ...prev.summary,
                      totalTasklists: prev.summary.totalTasklists + 1,
                    },
                  };
                }
                break;
              case 'add_task':
                if (update.tasklistId && update.task) {
                  return {
                    ...prev,
                    tasklists: prev.tasklists.map(tl =>
                      tl.id === update.tasklistId
                        ? { ...tl, tasks: [...tl.tasks, { ...update.task!, subtasks: [], tags: update.task!.tags || [] }] }
                        : tl
                    ),
                    summary: {
                      ...prev.summary,
                      totalTasks: prev.summary.totalTasks + 1,
                    },
                  };
                }
                break;
              case 'add_subtasks':
                if (update.taskId && update.subtasks) {
                  return {
                    ...prev,
                    tasklists: prev.tasklists.map(tl => ({
                      ...tl,
                      tasks: tl.tasks.map(t =>
                        t.id === update.taskId
                          ? { ...t, subtasks: [...t.subtasks, ...update.subtasks!] }
                          : t
                      ),
                    })),
                    summary: {
                      ...prev.summary,
                      totalSubtasks: prev.summary.totalSubtasks + update.subtasks.length,
                    },
                  };
                }
                break;
              case 'set_budget':
                if (update.budget) {
                  return {
                    ...prev,
                    budget: update.budget,
                  };
                }
                break;
            }
            return prev;
          });
        },
        onProjectDraftComplete: (message) => {
          // Mark draft as complete (no longer building)
          console.log("Project draft complete:", message);
          setProjectDraft((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              message: message || prev.message,
              isBuilding: false,
            } as ProjectDraftData;
          });
        },
        onComplete: async (fullText) => {
          setThinkingStatus("");
          const responseContent = fullText || receivedText || "Done.";

          // Add the final assistant message when complete
          const aiMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: responseContent,
            timestamp: new Date().toISOString(),
            topic: activeTopic,
          };
          setMessages((prev) => [...prev, aiMsg]);

          // Persist assistant message to Supabase
          if (isAuthenticated && activeConversation) {
            await supabaseService.addMessage(activeConversation.id, 'assistant', responseContent);
          }

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
      const response = await fetch(apiUrl(`/api/activity-status?${params}`));
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

  // Show loading state while auth is being restored
  if (isConfigured && isAuthLoading) {
    return (
      <div className="h-screen bg-[#121214] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          <p className="text-zinc-500 font-mono text-sm">AUTHENTICATING...</p>
        </div>
      </div>
    );
  }

  // Show login screen if Supabase is configured but user is not authenticated
  if (isConfigured && !isAuthenticated) {
    return <LoginScreen />;
  }

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
                onClick={() => setShowSettings(true)}
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

          {/* User Menu (when authenticated) */}
          {isAuthenticated ? (
            <UserMenu />
          ) : isConfigured ? (
            <LoginButton variant="outline" className="ml-2" />
          ) : null}
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
                <span className="font-bold">
                  {isAuthenticated && profile?.display_name
                    ? profile.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    : 'JS'}
                </span>
              </div>
              <div>
                <div className="font-bold">
                  {isAuthenticated && profile?.display_name
                    ? profile.display_name
                    : 'Guest User'}
                </div>
                <div className="opacity-70">
                  {isAuthenticated ? 'Signed In' : 'Not Signed In'}
                </div>
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
                attachedFiles={attachedFiles}
                onFilesChange={setAttachedFiles}
                currentConversation={currentConversation}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            </div>

            {/* Right: Data Display Panel */}
            <div className="flex-1 min-w-0 h-full">
              <DataDisplayPanel 
                data={displayData} 
                theme={theme} 
                onRequestChart={handleRequestChart}
                onVisualizationRequest={handleVisualizationRequest}
                isLoading={isChartLoading}
                draftData={timelogDraft}
                onDraftUpdate={handleTimelogDraftUpdate}
                onDraftRemove={handleTimelogDraftRemove}
                onDraftSubmit={handleTimelogDraftSubmit}
                isSubmitting={isSubmittingTimelog}
                projectDraftData={projectDraft}
                onProjectDraftSubmit={handleProjectDraftSubmit}
                isCreatingProject={isCreatingProject}
                onUpdateProjectTasklist={handleProjectTasklistUpdate}
                onUpdateProjectTask={handleProjectTaskUpdate}
                hourlyRate={hourlyRate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        hourlyRate={hourlyRate}
        onHourlyRateChange={setHourlyRate}
        theme={theme}
      />
    </div>
  );
}

// App wrapper with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
