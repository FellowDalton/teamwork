import { Project, Task } from "../types";
import { DisplayData, DisplayItem, ConversationTopic, ProjectDraftData, ProjectDraftUpdateEvent } from "../types/conversation";

// Helper to call Claude API via backend proxy
async function callClaude(
  systemPrompt: string,
  userMessage: string,
  tools?: any[]
): Promise<any> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      ...(tools && { tools }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  return response.json();
}

// Generate project structure
export const generateProjectStructure = async (
  prompt: string
): Promise<Partial<Project>> => {
  try {
    const systemPrompt = `You are an expert project manager. Generate realistic, detailed project structures.
Always respond with valid JSON matching this exact structure:
{
  "name": "string",
  "description": "string",
  "stages": [
    {
      "name": "string",
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "priority": "low" | "medium" | "high",
          "tags": ["string"]
        }
      ]
    }
  ]
}`;

    const userMessage = `Create a comprehensive project management board structure for a project described as: "${prompt}".
Include 4-6 typical workflow stages (e.g., Backlog, Design, Dev, QA, Done) appropriate for this type of project.
Populate each stage with 2-3 realistic sample tasks.
Respond ONLY with the JSON, no other text.`;

    const response = await callClaude(systemPrompt, userMessage);

    const textContent = response.content.find(
      (c: any) => c.type === "text"
    )?.text;
    if (!textContent) throw new Error("No response from AI");

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const data = JSON.parse(jsonStr.trim());

    // Transform to internal model with IDs
    return {
      name: data.name,
      description: data.description,
      stages: data.stages.map((stage: any, index: number) => ({
        id: `stage-${Date.now()}-${index}`,
        name: stage.name,
        tasks: stage.tasks.map((task: any, tIndex: number) => ({
          id: `task-${Date.now()}-${index}-${tIndex}`,
          title: task.title,
          description: task.description || "",
          priority: task.priority as "low" | "medium" | "high",
          tags: task.tags || [],
          assignedTo: `https://picsum.photos/seed/${Math.random()}/32/32`,
          timeLogs: [],
          comments: [],
        })),
      })),
    };
  } catch (error) {
    console.error("Failed to generate project:", error);
    throw error;
  }
};

export const suggestNextTask = async (
  currentTasks: string[],
  projectContext: string
): Promise<Task> => {
  try {
    const systemPrompt = `You are a project management assistant. Suggest logical next tasks for projects.
Always respond with valid JSON matching this exact structure:
{
  "title": "string",
  "description": "string",
  "priority": "low" | "medium" | "high",
  "tags": ["string"]
}`;

    const userMessage = `Given the project context: "${projectContext}" and existing tasks: ${JSON.stringify(currentTasks)}, suggest a new, logical next task.
Respond ONLY with the JSON, no other text.`;

    const response = await callClaude(systemPrompt, userMessage);

    const textContent = response.content.find(
      (c: any) => c.type === "text"
    )?.text;
    if (!textContent) throw new Error("No response from AI");

    // Extract JSON from response
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const taskData = JSON.parse(jsonStr.trim());

    return {
      id: `task-gen-${Date.now()}`,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      tags: taskData.tags,
      assignedTo: `https://picsum.photos/seed/${Date.now()}/32/32`,
      timeLogs: [],
      comments: [],
    };
  } catch (e) {
    console.error(e);
    throw new Error("Failed to suggest task");
  }
};

// --- Chat & Time Logging Capability ---

const tools = [
  {
    name: "logWork",
    description:
      "Log working hours to a specific task and add a comment. Detects if hours are billable (default true unless specified otherwise).",
    input_schema: {
      type: "object",
      properties: {
        taskName: {
          type: "string",
          description:
            "The name of the task to log time for. Try to fuzzy match based on user input.",
        },
        hours: { type: "number", description: "Number of hours to log." },
        comment: {
          type: "string",
          description: "A comment describing the work done.",
        },
        isBillable: {
          type: "boolean",
          description: "Whether the hours are billable.",
        },
      },
      required: ["hours", "comment"],
    },
  },
  {
    name: "createProject",
    description:
      "Create a new project with a structured workflow (stages and tasks) based on the user's description.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the project" },
        description: {
          type: "string",
          description: "A description of the project",
        },
        stages: {
          type: "array",
          description: "The workflow stages of the project",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  "Name of the workflow stage (e.g. 'To Do', 'In Progress')",
              },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    priority: { type: "string", enum: ["low", "medium", "high"] },
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "priority", "tags"],
                },
              },
            },
            required: ["name", "tasks"],
          },
        },
      },
      required: ["name", "description", "stages"],
    },
  },
  {
    name: "displayTasks",
    description:
      "Display a list of tasks in the data panel. Use this when the user asks to see tasks, task lists, or project progress.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title for the display panel (e.g. 'Project Tasks', 'High Priority Items')",
        },
        subtitle: {
          type: "string",
          description: "Optional subtitle with additional context",
        },
        filter: {
          type: "object",
          description: "Optional filter criteria for tasks",
          properties: {
            priority: { type: "string", enum: ["low", "medium", "high"] },
            stageName: { type: "string" },
            limit: { type: "number" },
          },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "displayTimelogs",
    description:
      "Display time log entries in the data panel. Use when user asks about logged hours or time tracking.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title for the display (e.g. 'Recent Time Entries', 'This Week')",
        },
        subtitle: {
          type: "string",
          description: "Optional subtitle",
        },
        taskName: {
          type: "string",
          description: "Optional task name to filter time logs",
        },
        limit: {
          type: "number",
          description: "Maximum number of entries to show",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "displayStatus",
    description:
      "Display project status metrics and overview in the data panel. Use when user asks about status, progress, or project overview.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title for the status display",
        },
        showMetrics: {
          type: "boolean",
          description: "Whether to include numerical metrics (task counts, hours, etc.)",
        },
        showTasks: {
          type: "boolean",
          description: "Whether to include task breakdown by stage",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "displayActivityStatus",
    description:
      "Display user activity status - what they worked on, time logged, and recent activity. Use when user asks 'what did I work on today/this week?', 'show my activity', 'how many hours did I log?', etc.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title for the activity display (e.g. 'Today's Activity', 'This Week's Work')",
        },
        period: {
          type: "string",
          enum: ["today", "yesterday", "thisweek", "lastweek"],
          description: "Time period to show activity for. Defaults to 'today'.",
        },
      },
      required: ["title"],
    },
  },
];

export interface ToolCallResponse {
  type: "tool_call";
  functionName: string;
  args: any;
  text?: string;
}

export interface TextResponse {
  type: "text";
  text: string;
}

export interface ChatCommandOptions {
  message: string;
  systemContext: string;
  topic: ConversationTopic;
}

export interface CardData {
  id: string;
  type: 'timelog';
  projectName: string;
  taskName: string;
  hours: number;
  date: string;
  description?: string;
}

export interface CardAgentResponse {
  cards: CardData[];
  summary: {
    totalHours: number;
    totalEntries: number;
    totalTasks: number;
    periodLabel: string;
  };
}

export interface VisualizationSpec {
  type: 'summary' | 'cards' | 'chart';
  title?: string;
  metrics?: Array<{ label: string; value: string; emphasis?: boolean }>;
  breakdown?: Array<{ label: string; hours: number; percentage: number }>;
  items?: Array<{
    id: string;
    date: string;
    taskName: string;
    projectName: string;
    hours: number;
    description?: string;
  }>;
  chartType?: 'bar' | 'line';
  data?: Array<{ label: string; value: number }>;
  summary?: {
    totalHours?: number;
    totalEntries?: number;
    totalTasks?: number;
    total?: number;
    average?: number;
  };
}

// Timelog draft data structure
export interface TimelogDraftEntry {
  id: string;
  taskId: number;
  taskName: string;
  projectId: number;
  projectName: string;
  hours: number;
  date: string;
  comment: string;
  confidence: number;
  isBillable: boolean;
}

export interface TimelogDraftData {
  entries: TimelogDraftEntry[];
  summary: {
    totalHours: number;
    totalEntries: number;
    dateRange: string;
  };
  message: string;
  isDraft: true;
}

export interface StreamingChatOptions {
  message: string;
  topic: ConversationTopic;
  projectId?: number;
  projectName?: string;
  onChunk: (text: string) => void;
  onThinking: (thinking: string, fullText?: string) => void;
  onCards?: (data: CardAgentResponse) => void;
  onVisualization?: (spec: VisualizationSpec) => void;
  onTimelogDraft?: (draft: TimelogDraftData) => void;
  onProjectDraft?: (draft: ProjectDraftData) => void;
  onProjectDraftUpdate?: (update: ProjectDraftUpdateEvent) => void;
  onProjectDraftComplete?: (message?: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

// Streaming chat using Server-Sent Events
// TODO: When backend migrates to Agent SDK, this will get true streaming
// Currently receives full response at once due to Claude CLI limitations
export const processStreamingChat = async (options: StreamingChatOptions): Promise<void> => {
  const { message, topic, projectId, projectName, onChunk, onThinking, onCards, onVisualization, onComplete, onError } = options;
  
  const modeMap: Record<ConversationTopic, string> = {
    project: 'project',
    status: 'status',
    timelog: 'timelog',
    general: 'general',
  };

  try {
    const response = await fetch("/api/claude/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        mode: modeMap[topic],
        projectId: projectId,
        projectName: projectName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.done) {
            onComplete(fullText);
            return;
          }
          
          // Handle different event types
          if (data.type === 'thinking' && data.thinking) {
            onThinking(data.thinking, data.fullText);
          } else if (data.type === 'tool_use') {
            // Don't show tool usage in chat - user only wants to see thoughts
            console.log('Agent using tool:', data.tool);
          } else if (data.type === 'text' && data.text) {
            fullText += data.text;
            onChunk(data.text);
          } else if (data.type === 'result' && data.text) {
            fullText = data.text;
            onChunk(data.text);
          } else if (data.type === 'cards' && data.cards && onCards) {
            // CardAgent response - display in data panel (legacy)
            onCards({ cards: data.cards, summary: data.summary });
          } else if (data.type === 'visualization' && data.spec && onVisualization) {
            // Creative visualization agent response
            onVisualization(data.spec);
          } else if (data.text) {
            // Legacy format fallback
            if (data.final) {
              fullText = data.text;
            } else {
              fullText += data.text;
            }
            onChunk(data.text);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    onComplete(fullText);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

// Agent SDK streaming - uses skills for intelligent Teamwork interactions
// No hard-coded date parsing - Claude handles everything via skills
export const processAgentStream = async (options: StreamingChatOptions): Promise<void> => {
  const { message, topic, projectId, projectName, onChunk, onThinking, onVisualization, onTimelogDraft, onProjectDraft, onProjectDraftUpdate, onProjectDraftComplete, onComplete, onError } = options;
  
  const modeMap: Record<ConversationTopic, string> = {
    project: 'project',
    status: 'status',
    timelog: 'timelog',
    general: 'general',
  };

  try {
    const response = await fetch("/api/agent/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        mode: modeMap[topic],
        projectId: projectId,
        projectName: projectName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

      let streamDone = false;
      for (const line of lines) {
        const data = line.slice(6); // Remove "data: " prefix

        if (data === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(data);
          
          if (parsed.type === 'init') {
            console.log('Agent initialized:', parsed.model, parsed.tools);
          } else if (parsed.type === 'text' && parsed.text) {
            fullText += parsed.text;
            onChunk(parsed.text);
          } else if (parsed.type === 'thinking' && parsed.thinking) {
            onThinking(parsed.thinking, parsed.fullText);
          } else if (parsed.type === 'tool_use') {
            // Don't show tool usage in chat - user only wants to see thoughts
            console.log('Agent using tool:', parsed.tool);
          } else if (parsed.type === 'result' && parsed.text) {
            fullText = parsed.text;
            onChunk(parsed.text);
          } else if (parsed.type === 'visualization' && parsed.spec && onVisualization) {
            onVisualization(parsed.spec);
          } else if (parsed.type === 'timelog_draft' && parsed.draft && onTimelogDraft) {
            // Handle draft timelog entries for review/editing
            const draft: TimelogDraftData = {
              entries: parsed.draft.entries,
              summary: parsed.draft.summary,
              message: parsed.draft.message,
              isDraft: true,
            };
            onTimelogDraft(draft);
          } else if (parsed.type === 'project_draft' && parsed.draft && onProjectDraft) {
            // Handle project draft for review/editing (final or legacy)
            const draft: ProjectDraftData = {
              project: parsed.draft.project,
              tasklists: parsed.draft.tasklists,
              budget: parsed.draft.budget,
              summary: parsed.draft.summary,
              message: parsed.draft.message,
              isDraft: true,
            };
            onProjectDraft(draft);
          } else if (parsed.type === 'project_draft_init' && parsed.draft && onProjectDraft) {
            // Handle progressive project draft initialization
            const draft: ProjectDraftData = {
              project: parsed.draft.project,
              tasklists: parsed.draft.tasklists || [],
              summary: parsed.draft.summary,
              message: '',
              isDraft: true,
            };
            // Mark as building so UI knows more content is coming
            (draft as any).isBuilding = true;
            onProjectDraft(draft);
          } else if (parsed.type === 'project_draft_update' && onProjectDraftUpdate) {
            // Handle progressive updates (add_tasklist, add_task, add_subtasks, set_budget)
            onProjectDraftUpdate({
              type: 'project_draft_update',
              action: parsed.action,
              tasklist: parsed.tasklist,
              tasklistId: parsed.tasklistId,
              task: parsed.task,
              taskId: parsed.taskId,
              subtasks: parsed.subtasks,
              budget: parsed.budget,
            });
          } else if (parsed.type === 'project_draft_complete' && onProjectDraftComplete) {
            // Handle project draft completion
            onProjectDraftComplete(parsed.message);
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue; // Skip invalid JSON
          throw e;
        }
      }

      if (streamDone) break;
    }

    onComplete(fullText);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

export const processChatCommand = async (
  options: ChatCommandOptions
): Promise<ToolCallResponse | TextResponse> => {
  const { message, systemContext, topic } = options;

  try {
    // Topic-specific instructions
    const topicInstructions: Record<ConversationTopic, string> = {
      project: `The user is in PROJECT CREATION mode. Help them create a new project.
When they describe a project, use 'createProject' to generate a full project structure with appropriate stages and tasks.
Don't ask for every detail - infer a good structure from their high-level description.`,
      status: `The user is in STATUS mode, wanting to see project status and progress.
When they ask about status, use 'displayStatus' to show metrics and progress.
Use 'displayTasks' to show task breakdowns when relevant.
Provide concise status summaries and insights.`,
      timelog: `The user is in TIME LOG mode, focused on time tracking.
When they want to log time, use 'logWork' with the appropriate task and hours.
When they want to see logged time, use 'displayTimelogs'.
Help them track and understand their time usage.`,
      general: `The user is in general chat mode.
Help with any questions about their projects, tasks, or workflow.
Use display tools when showing data would be helpful.
Be proactive in offering relevant information.`
    };

    const systemPrompt = `You are an advanced Project AI assistant integrated into a workflow management app.
The interface has two panels: a chat panel (where we're talking) and a data display panel on the right.
You can populate the data display panel using the display tools.

CURRENT MODE: ${topic.toUpperCase()}
${topicInstructions[topic]}

CURRENT APP CONTEXT:
${systemContext}

AVAILABLE TOOLS:
1. logWork - Log working hours to a task
2. createProject - Create a new project with stages and tasks
3. displayTasks - Show tasks in the data panel (use when user asks to see tasks)
4. displayTimelogs - Show time log entries in the data panel
5. displayStatus - Show project status/metrics in the data panel
6. displayActivityStatus - Show user's work activity (use when user asks "what did I work on today/this week?")

BEHAVIOR:
- Be concise and professional, like a hardware synth interface.
- Use short, technical responses.
- When showing data would help the user, use the appropriate display tool.
- When in status mode, proactively show relevant metrics.
- Match task names fuzzily when logging time.`;

    // Map topic to mode for Claude CLI
    const modeMap: Record<ConversationTopic, string> = {
      project: 'project',
      status: 'status',
      timelog: 'timelog',
      general: 'general',
    };

    // Use Claude CLI endpoint (uses subscription auth, no API credits needed)
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        mode: modeMap[topic],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();

    // Check if response suggests showing activity status
    const lowerMessage = message.toLowerCase();
    
    // Auto-detect if we should show activity status
    if (topic === 'status' && (
      lowerMessage.includes('work on') ||
      lowerMessage.includes('activity') ||
      lowerMessage.includes('hours') ||
      lowerMessage.includes('logged')
    )) {
      // Detect period from message
      let period = 'today';
      if (lowerMessage.includes('yesterday')) period = 'yesterday';
      else if (lowerMessage.includes('this week')) period = 'thisweek';
      else if (lowerMessage.includes('last week')) period = 'lastweek';
      
      return {
        type: "tool_call",
        functionName: "displayActivityStatus",
        args: { title: "Activity Status", period },
        text: data.response,
      };
    }

    // Return text response
    return {
      type: "text",
      text: data.response || "I'm not sure how to help with that.",
    };
  } catch (error) {
    console.error("Chat Error:", error);
    return { type: "text", text: "System Error: Connection interrupted." };
  }
};

// Request an additional chart visualization
export interface ChartRequestOptions {
  chartType: string;
  projectId?: number;
  onVisualization: (spec: VisualizationSpec) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

export const requestAdditionalChart = async (options: ChartRequestOptions): Promise<void> => {
  const { chartType, projectId, onVisualization, onError, onComplete } = options;

  try {
    const response = await fetch("/api/agent/chart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chartType,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chart request error: ${response.status}`);
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
            onVisualization(parsed.spec);
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

// Submit timelog entries to Teamwork
export interface TimelogSubmitResult {
  success: boolean;
  submitted: number;
  total: number;
  totalHours: number;
  message: string;
  results: Array<{ success: boolean; taskId: number; error?: string }>;
}

export const submitTimelogEntries = async (
  entries: Array<{
    taskId: number;
    hours: number;
    date: string;
    comment: string;
  }>
): Promise<TimelogSubmitResult> => {
  const response = await fetch("/api/agent/timelog/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entries }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit time entries: ${response.status}`);
  }

  return response.json();
};

// Submit project to Teamwork
export interface ProjectSubmitResult {
  success: boolean;
  projectId?: number;
  projectName?: string;
  projectUrl?: string;
  summary?: {
    tasklistsCreated: number;
    tasksCreated: number;
    subtasksCreated: number;
  };
  message: string;
  error?: string;
}

export const submitProject = async (
  projectData: {
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
        dueDate?: string;
        tags?: Array<{ name: string }>;
        subtasks?: Array<{ name: string; description?: string }>;
      }>;
    }>;
    budget?: {
      type: 'time' | 'money';
      capacity: number;
    };
  }
): Promise<ProjectSubmitResult> => {
  const response = await fetch("/api/agent/project/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(projectData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to create project: ${response.status}`);
  }

  return response.json();
};
