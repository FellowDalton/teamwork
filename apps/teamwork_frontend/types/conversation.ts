import { Task, TimeLog, Comment, Project } from '../types';

// Conversation topic modes
export type ConversationTopic = 'project' | 'status' | 'timelog' | 'general';

// Chat message structure
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  topic: ConversationTopic;
  displayData?: DisplayData; // Data to show in right panel
  isThought?: boolean; // Marks intermediate thinking messages from Claude
}

// Data display panel types
export type DisplayType = 'tasks' | 'timelogs' | 'status' | 'project-overview' | 'activity' | 'empty';

export interface DisplayData {
  type: DisplayType;
  title: string;
  subtitle?: string;
  items: DisplayItem[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartDisplayData {
  chartType: 'bar' | 'line';
  title: string;
  data: ChartDataPoint[];
  summary?: {
    total?: number;
    average?: number;
  };
}

export interface CustomDisplayData {
  title: string;
  svg: string;
  description?: string;
}

export interface DisplayItem {
  id: string;
  type: 'task' | 'timelog' | 'comment' | 'metric' | 'project-summary' | 'chart' | 'custom';
  data: TaskDisplayData | TimelogDisplayData | CommentDisplayData | MetricDisplayData | ProjectSummaryData | ChartDisplayData | CustomDisplayData;
}

// Specific display data types
export interface TaskDisplayData {
  task: Task;
  stageName?: string;
}

export interface TimelogDisplayData {
  timelog: TimeLog;
  taskTitle: string;
  projectName?: string;
}

export interface CommentDisplayData {
  comment: Comment;
  taskTitle: string;
}

export interface MetricDisplayData {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: 'cyan' | 'green' | 'orange' | 'red' | 'purple' | 'blue';
  icon?: string;
}

export interface ProjectSummaryData {
  project: Project;
  taskCount: number;
  completedCount: number;
  totalHours: number;
}

// AI tool response types for display updates
export interface DisplayToolCall {
  type: 'display';
  displayType: DisplayType;
  title: string;
  subtitle?: string;
  items: DisplayItem[];
}

// Status summary structure
export interface ProjectStatus {
  totalTasks: number;
  byStage: { stageName: string; count: number }[];
  totalHours: number;
  billableHours: number;
  recentActivity: {
    type: 'timelog' | 'comment' | 'task-created';
    description: string;
    timestamp: string;
  }[];
}

// Timelog draft entry (editable before submission)
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

// Timelog draft data for display panel
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

// Project draft types for create project wizard
export interface ProjectDraftTag {
  id?: number;
  name: string;
  color?: string;
  isNew?: boolean;
}

export interface SubtaskDraft {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  estimatedMinutes?: number;
}

export interface TaskDraft {
  id: string;
  name: string;
  description?: string;
  priority?: 'none' | 'low' | 'medium' | 'high';
  dueDate?: string;
  startDate?: string;
  estimatedMinutes?: number;
  tags: ProjectDraftTag[];
  subtasks: SubtaskDraft[];
}

export interface TasklistDraft {
  id: string;
  name: string;
  description?: string;
  tasks: TaskDraft[];
}

export interface ProjectBudgetDraft {
  type: 'time' | 'money';
  capacity: number;
  timelogType?: 'all' | 'billable';
}

export interface ProjectDraftData {
  project: {
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    tags: ProjectDraftTag[];
  };
  tasklists: TasklistDraft[];
  budget?: ProjectBudgetDraft;
  summary: {
    totalTasklists: number;
    totalTasks: number;
    totalSubtasks: number;
    totalMinutes?: number;
  };
  message: string;
  isDraft: true;
  // Set after successful creation
  isCreated?: boolean;
  createdProjectUrl?: string;
}

// File attachment for conversation
export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
}

// Progressive project draft SSE event types
export type ProjectDraftUpdateAction =
  | 'add_tasklist'
  | 'add_task'
  | 'add_subtasks'
  | 'update_project'
  | 'set_budget';

export interface ProjectDraftInitEvent {
  type: 'project_draft_init';
  draft: {
    project: {
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      tags: ProjectDraftTag[];
    };
    tasklists: TasklistDraft[];
    summary: {
      totalTasklists: number;
      totalTasks: number;
      totalSubtasks: number;
    };
    isBuilding: true;
    isDraft: true;
  };
}

export interface ProjectDraftUpdateEvent {
  type: 'project_draft_update';
  action: ProjectDraftUpdateAction;
  tasklist?: TasklistDraft;
  tasklistId?: string;
  task?: TaskDraft;
  taskId?: string;
  subtasks?: SubtaskDraft[];
  budget?: ProjectBudgetDraft;
}

export interface ProjectDraftCompleteEvent {
  type: 'project_draft_complete';
  message?: string;
}

// Union type for all progressive draft events
export type ProjectDraftStreamEvent =
  | ProjectDraftInitEvent
  | ProjectDraftUpdateEvent
  | ProjectDraftCompleteEvent;

// Extended ProjectDraftData with building state
export interface ProjectDraftDataWithBuilding extends Omit<ProjectDraftData, 'isDraft'> {
  isDraft: true;
  isBuilding?: boolean;
}

// JSON Lines streaming format for project creation
// Each line is a complete JSON object - enables progressive rendering while preserving holistic planning
export type ProjectLine =
  | { type: 'project'; name: string; description?: string; startDate?: string; endDate?: string; budgetHours?: number }
  | { type: 'tasklist'; id: string; name: string; description?: string }
  | { type: 'task'; id: string; tasklistId: string; name: string; description?: string; priority?: string; estimatedMinutes?: number }
  | { type: 'subtask'; taskId: string; name: string; description?: string; estimatedMinutes?: number }
  | { type: 'complete'; message?: string };
