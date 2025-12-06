export interface TimeLog {
  id: string;
  hours: number;
  date: string;
  isBillable: boolean;
  comment: string;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  author: string; // 'AI' | 'User'
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string; // URL to avatar or name
  tags: string[];
  timeLogs: TimeLog[];
  comments: Comment[];
}

export interface Stage {
  id: string;
  name: string;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  stages: Stage[];
  lastUpdated: string;
}

// ViewState and DragItem removed - no longer used in chat-centric UI