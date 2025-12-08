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
