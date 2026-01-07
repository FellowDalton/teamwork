/**
 * Frontend service to interact with the backend API
 * for Teamwork operations.
 */

import { apiUrl } from './apiConfig';

// Types matching the API client schemas
export interface TeamworkProject {
  id: number;
  name: string;
  description?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  activeWorkflow?: {
    id: number;
    name?: string;
  } | null;
}

export interface TeamworkTask {
  id: number;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  progress?: number;
  estimatedMinutes?: number;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  projectId?: number;
  assignees?: any;
  tags?: Array<{ id: number; name?: string; color?: string }>;
  workflowColumn?: {
    id: number;
    name?: string;
  } | null;
}

export interface TeamworkStage {
  id: number;
  name: string;
  color?: string;
  position?: number;
}

export interface TeamworkTimeEntry {
  id: number;
  minutes: number;
  hours?: number;
  description?: string;
  date: string;
  isBillable?: boolean;
  userId?: number;
  taskId?: number | null;
  projectId?: number;
  createdAt?: string;
}

export interface ProjectWithDetails {
  project: TeamworkProject;
  tasklists: Array<{ id: number; name: string }>;
  tasks: TeamworkTask[];
  stages: TeamworkStage[];
}

class TeamworkService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = apiUrl(`/api${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get all active projects
   */
  async getProjects(): Promise<TeamworkProject[]> {
    const data = await this.request<{ projects: TeamworkProject[] }>('/projects');
    return data.projects;
  }

  /**
   * Get a single project with its tasks and stages
   */
  async getProject(projectId: number): Promise<ProjectWithDetails> {
    return this.request<ProjectWithDetails>(`/projects/${projectId}`);
  }

  /**
   * Get tasks for a project
   */
  async getProjectTasks(projectId: number): Promise<TeamworkTask[]> {
    const data = await this.request<{ tasks: TeamworkTask[] }>(`/projects/${projectId}/tasks`);
    return data.tasks;
  }

  /**
   * Get time entries for a project
   */
  async getTimeEntries(projectId?: number): Promise<TeamworkTimeEntry[]> {
    const endpoint = projectId 
      ? `/projects/${projectId}/time-entries`
      : '/time-entries';
    const data = await this.request<{ timelogs: TeamworkTimeEntry[] }>(endpoint);
    return data.timelogs;
  }

  /**
   * Log time to a task
   */
  async logTime(
    taskId: number,
    hours: number,
    description: string,
    isBillable: boolean = true,
    date?: string
  ): Promise<TeamworkTimeEntry> {
    const data = await this.request<{ timelog: TeamworkTimeEntry }>(`/tasks/${taskId}/time`, {
      method: 'POST',
      body: JSON.stringify({
        hours,
        description,
        isBillable,
        date: date || new Date().toISOString().split('T')[0],
      }),
    });
    return data.timelog;
  }

  /**
   * Get workflows
   */
  async getWorkflows(): Promise<Array<{ id: number; name: string; stages?: TeamworkStage[] }>> {
    const data = await this.request<{ workflows: Array<{ id: number; name: string; stages?: TeamworkStage[] }> }>('/workflows');
    return data.workflows;
  }

  /**
   * Get stages for a workflow
   */
  async getWorkflowStages(workflowId: number): Promise<TeamworkStage[]> {
    const data = await this.request<{ stages: TeamworkStage[] }>(`/workflows/${workflowId}/stages`);
    return data.stages;
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<{
    status: string;
    hasTeamworkConfig: boolean;
    hasAnthropicConfig: boolean;
    defaultProjectId?: string;
  }> {
    return this.request('/health');
  }
}

export const teamworkService = new TeamworkService();
export default teamworkService;
