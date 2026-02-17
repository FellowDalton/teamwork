/**
 * Tasks resource module for Teamwork API.
 * Provides CRUD operations and filtering for tasks.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type ApiTask,
  type TaskListResponse,
  type TaskResponse,
  type CreateTaskRequest,
  type UpdateTaskRequest,
  TaskListResponseSchema,
  TaskResponseSchema,
} from '../types.ts';

export interface ListTasksOptions {
  /** Filter by status (e.g., 'new', 'in progress', 'completed') */
  statuses?: string[];
  /** Filter by tag IDs */
  tagIds?: number[];
  /** Filter by assignee user IDs */
  assigneeUserIds?: number[];
  /** Filter by assignee team IDs */
  assigneeTeamIds?: number[];
  /** Include related data */
  include?: ('tags' | 'assignees' | 'users' | 'teams')[];
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Order by field */
  orderBy?: string;
  /** Order direction */
  orderMode?: 'asc' | 'desc';
  /** Filter by updated after date */
  updatedAfter?: string;
  /** Include completed tasks */
  includeCompletedTasks?: boolean;
  /** Search term */
  searchTerm?: string;
}

export interface CreateTaskOptions {
  name: string;
  description?: string;
  priority?: 'none' | 'low' | 'medium' | 'high';
  startDate?: string;
  dueDate?: string;
  estimatedMinutes?: number;
  assigneeUserIds?: number[];
  assigneeTeamIds?: number[];
  tagIds?: number[];
}

export interface UpdateTaskOptions {
  name?: string;
  description?: string;
  status?: string;
  priority?: 'none' | 'low' | 'medium' | 'high';
  progress?: number;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number;
  assigneeUserIds?: number[];
  assigneeTeamIds?: number[];
  tagIds?: number[];
}

/**
 * Tasks resource for Teamwork API.
 */
export class TasksResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * List all tasks across all projects.
   */
  async list(options?: ListTasksOptions): Promise<TaskListResponse> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (options?.statuses?.length) {
      params['taskStatuses'] = options.statuses.join(',');
    }
    if (options?.tagIds?.length) {
      params['tagIds'] = options.tagIds.join(',');
    }
    if (options?.assigneeUserIds?.length) {
      params['assignedToUserIds'] = options.assigneeUserIds.join(',');
    }
    if (options?.assigneeTeamIds?.length) {
      params['assignedToTeamIds'] = options.assigneeTeamIds.join(',');
    }
    if (options?.include?.length) {
      params['include'] = options.include;
    }
    if (options?.page !== undefined) {
      params['page'] = options.page;
    }
    if (options?.pageSize !== undefined) {
      params['pageSize'] = options.pageSize;
    }
    if (options?.orderBy) {
      params['orderBy'] = options.orderBy;
    }
    if (options?.orderMode) {
      params['orderMode'] = options.orderMode;
    }
    if (options?.updatedAfter) {
      params['updatedAfter'] = options.updatedAfter;
    }
    if (options?.includeCompletedTasks !== undefined) {
      params['includeCompletedTasks'] = options.includeCompletedTasks;
    }
    if (options?.searchTerm) {
      params['searchTerm'] = options.searchTerm;
    }

    const response = await this.client.get<TaskListResponse>('/projects/api/v3/tasks.json', params);
    return TaskListResponseSchema.parse(response);
  }

  /**
   * List tasks for a specific project.
   */
  async listByProject(projectId: number, options?: ListTasksOptions): Promise<TaskListResponse> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (options?.statuses?.length) {
      params['taskStatuses'] = options.statuses.join(',');
    }
    if (options?.tagIds?.length) {
      params['tagIds'] = options.tagIds.join(',');
    }
    if (options?.assigneeUserIds?.length) {
      params['assignedToUserIds'] = options.assigneeUserIds.join(',');
    }
    if (options?.assigneeTeamIds?.length) {
      params['assignedToTeamIds'] = options.assigneeTeamIds.join(',');
    }
    if (options?.include?.length) {
      params['include'] = options.include;
    }
    if (options?.page !== undefined) {
      params['page'] = options.page;
    }
    if (options?.pageSize !== undefined) {
      params['pageSize'] = options.pageSize;
    }
    if (options?.orderBy) {
      params['orderBy'] = options.orderBy;
    }
    if (options?.orderMode) {
      params['orderMode'] = options.orderMode;
    }
    if (options?.updatedAfter) {
      params['updatedAfter'] = options.updatedAfter;
    }
    if (options?.includeCompletedTasks !== undefined) {
      params['includeCompletedTasks'] = options.includeCompletedTasks;
    }
    if (options?.searchTerm) {
      params['searchTerm'] = options.searchTerm;
    }

    const response = await this.client.get<TaskListResponse>(
      `/projects/api/v3/projects/${projectId}/tasks.json`,
      params
    );
    return TaskListResponseSchema.parse(response);
  }

  /**
   * List tasks for a specific tasklist.
   */
  async listByTasklist(tasklistId: number, options?: ListTasksOptions): Promise<TaskListResponse> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (options?.statuses?.length) {
      params['taskStatuses'] = options.statuses.join(',');
    }
    if (options?.include?.length) {
      params['include'] = options.include;
    }
    if (options?.page !== undefined) {
      params['page'] = options.page;
    }
    if (options?.pageSize !== undefined) {
      params['pageSize'] = options.pageSize;
    }

    const response = await this.client.get<TaskListResponse>(
      `/projects/api/v3/tasklists/${tasklistId}/tasks.json`,
      params
    );
    return TaskListResponseSchema.parse(response);
  }

  /**
   * Get a single task by ID.
   */
  async get(taskId: number, include?: ('tags' | 'assignees' | 'users' | 'teams')[]): Promise<ApiTask> {
    const params: Record<string, string | string[] | undefined> = {};

    if (include?.length) {
      params['include'] = include;
    }

    const response = await this.client.get<TaskResponse>(`/projects/api/v3/tasks/${taskId}.json`, params);
    const parsed = TaskResponseSchema.parse(response);
    return parsed.task;
  }

  /**
   * Create a new task in a tasklist.
   */
  async create(tasklistId: number, options: CreateTaskOptions): Promise<ApiTask> {
    // Note: V3 API expects 'dueAt' and 'startAt' for creation, but returns 'dueDate' and 'startDate'
    const body: any = {
      task: {
        name: options.name,
        description: options.description,
        priority: options.priority,
        startAt: options.startDate,  // API uses 'startAt' for input
        dueAt: options.dueDate,      // API uses 'dueAt' for input
        estimatedMinutes: options.estimatedMinutes,
        tagIds: options.tagIds,
      },
    };

    if (options.assigneeUserIds?.length || options.assigneeTeamIds?.length) {
      body.task.assignees = {
        userIds: options.assigneeUserIds,
        teamIds: options.assigneeTeamIds,
      };
    }

    const response = await this.client.post<TaskResponse>(
      `/projects/api/v3/tasklists/${tasklistId}/tasks.json`,
      body
    );
    const parsed = TaskResponseSchema.parse(response);
    return parsed.task;
  }

  /**
   * Update an existing task.
   */
  async update(taskId: number, options: UpdateTaskOptions): Promise<ApiTask> {
    const body: UpdateTaskRequest = {
      task: {},
    };

    if (options.name !== undefined) body.task.name = options.name;
    if (options.description !== undefined) body.task.description = options.description;
    if (options.status !== undefined) body.task.status = options.status;
    if (options.priority !== undefined) body.task.priority = options.priority;
    if (options.progress !== undefined) body.task.progress = options.progress;
    // Note: V3 API uses 'startAt' and 'dueAt' for updates, not 'startDate' and 'dueDate'
    if (options.startDate !== undefined) (body.task as any).startAt = options.startDate;
    if (options.dueDate !== undefined) (body.task as any).dueAt = options.dueDate;
    if (options.estimatedMinutes !== undefined) body.task.estimatedMinutes = options.estimatedMinutes;
    if (options.tagIds !== undefined) body.task.tagIds = options.tagIds;

    if (options.assigneeUserIds !== undefined || options.assigneeTeamIds !== undefined) {
      body.task.assignees = {
        userIds: options.assigneeUserIds,
        teamIds: options.assigneeTeamIds,
      };
    }

    const response = await this.client.patch<TaskResponse>(`/projects/api/v3/tasks/${taskId}.json`, body);
    const parsed = TaskResponseSchema.parse(response);
    return parsed.task;
  }

  /**
   * Delete a task.
   */
  async delete(taskId: number): Promise<void> {
    await this.client.delete(`/projects/api/v3/tasks/${taskId}.json`);
  }

  /**
   * Complete a task.
   */
  async complete(taskId: number): Promise<ApiTask> {
    return this.update(taskId, { status: 'completed' });
  }

  /**
   * Reopen a completed task.
   */
  async reopen(taskId: number): Promise<ApiTask> {
    return this.update(taskId, { status: 'reopened' });
  }
}
