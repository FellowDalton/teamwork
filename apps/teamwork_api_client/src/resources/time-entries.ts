/**
 * Time Entries resource module for Teamwork API.
 * Provides CRUD operations for time tracking/timelogs.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type TimeEntry,
  type TimeEntryListResponse,
  type TimeEntryResponse,
  type CreateTimeEntryRequest,
  type UpdateTimeEntryRequest,
  TimeEntryListResponseSchema,
  TimeEntryResponseSchema,
} from '../types.ts';

export interface ListTimeEntriesOptions {
  /** Filter by start date (YYYY-MM-DD) */
  startDate?: string;
  /** Filter by end date (YYYY-MM-DD) */
  endDate?: string;
  /** Filter by updated after date (ISO 8601) */
  updatedAfter?: string;
  /** Filter by user IDs */
  userIds?: number[];
  /** Filter by task IDs */
  taskIds?: number[];
  /** Filter by tasklist IDs */
  tasklistIds?: number[];
  /** Filter by project IDs */
  projectIds?: number[];
  /** Filter by billable type: all, billable, non-billable */
  billableType?: 'all' | 'billable' | 'non-billable';
  /** Filter by invoiced type: all, invoiced, non-invoiced */
  invoicedType?: 'all' | 'invoiced' | 'non-invoiced';
  /** Filter by project status */
  projectStatus?: 'active' | 'completed' | 'archived' | 'all';
  /** Include related data */
  include?: ('users' | 'tasks' | 'projects' | 'tags')[];
  /** Order by field */
  orderBy?: 'date' | 'project' | 'user' | 'task';
  /** Order direction */
  orderMode?: 'asc' | 'desc';
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Include deleted entries */
  showDeleted?: boolean;
}

export interface CreateTimeEntryOptions {
  /** Minutes logged */
  minutes: number;
  /** Date for the entry (YYYY-MM-DD) */
  date: string;
  /** Description of work done */
  description?: string;
  /** Whether hours are billable */
  isBillable?: boolean;
  /** Optional time of day (HH:MM) */
  time?: string;
  /** Tag IDs to attach */
  tagIds?: number[];
  /** Task ID to log against (for project-level creation) */
  taskId?: number;
}

export interface UpdateTimeEntryOptions {
  /** Minutes logged */
  minutes?: number;
  /** Date for the entry (YYYY-MM-DD) */
  date?: string;
  /** Description of work done */
  description?: string;
  /** Whether hours are billable */
  isBillable?: boolean;
  /** Optional time of day (HH:MM) */
  time?: string;
  /** Tag IDs to attach */
  tagIds?: number[];
}

/**
 * Time Entries resource for Teamwork API.
 */
export class TimeEntriesResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * Build query params from options.
   */
  private buildParams(options?: ListTimeEntriesOptions): Record<string, string | number | boolean | string[] | undefined> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (!options) return params;

    if (options.startDate) params['startDate'] = options.startDate;
    if (options.endDate) params['endDate'] = options.endDate;
    if (options.updatedAfter) params['updatedAfter'] = options.updatedAfter;
    if (options.userIds?.length) params['userIds'] = options.userIds.join(',');
    if (options.taskIds?.length) params['taskIds'] = options.taskIds.join(',');
    if (options.tasklistIds?.length) params['tasklistIds'] = options.tasklistIds.join(',');
    if (options.projectIds?.length) params['projectIds'] = options.projectIds.join(',');
    if (options.billableType) params['billableType'] = options.billableType;
    if (options.invoicedType) params['invoicedType'] = options.invoicedType;
    if (options.projectStatus) params['projectStatus'] = options.projectStatus;
    if (options.include?.length) params['include'] = options.include.join(',');
    if (options.orderBy) params['orderBy'] = options.orderBy;
    if (options.orderMode) params['orderMode'] = options.orderMode;
    if (options.page !== undefined) params['page'] = options.page;
    if (options.pageSize !== undefined) params['pageSize'] = options.pageSize;
    if (options.showDeleted !== undefined) params['showDeleted'] = options.showDeleted;

    return params;
  }

  /**
   * List all time entries across all projects.
   */
  async list(options?: ListTimeEntriesOptions): Promise<TimeEntryListResponse> {
    const params = this.buildParams(options);
    const response = await this.client.get<TimeEntryListResponse>('/projects/api/v3/time.json', params);
    return TimeEntryListResponseSchema.parse(response);
  }

  /**
   * List time entries for a specific project.
   */
  async listByProject(projectId: number, options?: ListTimeEntriesOptions): Promise<TimeEntryListResponse> {
    const params = this.buildParams(options);
    const response = await this.client.get<TimeEntryListResponse>(
      `/projects/api/v3/projects/${projectId}/time.json`,
      params
    );
    return TimeEntryListResponseSchema.parse(response);
  }

  /**
   * List time entries for a specific task.
   */
  async listByTask(taskId: number, options?: ListTimeEntriesOptions): Promise<TimeEntryListResponse> {
    const params = this.buildParams(options);
    const response = await this.client.get<TimeEntryListResponse>(
      `/projects/api/v3/tasks/${taskId}/time.json`,
      params
    );
    return TimeEntryListResponseSchema.parse(response);
  }

  /**
   * Get a single time entry by ID.
   */
  async get(timeEntryId: number): Promise<TimeEntry> {
    const response = await this.client.get<TimeEntryResponse>(`/projects/api/v3/time/${timeEntryId}.json`);
    const parsed = TimeEntryResponseSchema.parse(response);
    return parsed.timelog;
  }

  /**
   * Create a time entry for a project.
   */
  async create(projectId: number, options: CreateTimeEntryOptions): Promise<TimeEntry> {
    const body: CreateTimeEntryRequest = {
      timelog: {
        minutes: options.minutes,
        date: options.date,
        description: options.description,
        isBillable: options.isBillable,
        time: options.time,
        tagIds: options.tagIds,
        taskId: options.taskId,
      },
    };

    const response = await this.client.post<TimeEntryResponse>(
      `/projects/api/v3/projects/${projectId}/time.json`,
      body
    );
    const parsed = TimeEntryResponseSchema.parse(response);
    return parsed.timelog;
  }

  /**
   * Create a time entry directly for a task.
   */
  async createForTask(taskId: number, options: Omit<CreateTimeEntryOptions, 'taskId'>): Promise<TimeEntry> {
    const body: CreateTimeEntryRequest = {
      timelog: {
        minutes: options.minutes,
        date: options.date,
        description: options.description,
        isBillable: options.isBillable,
        time: options.time,
        tagIds: options.tagIds,
      },
    };

    const response = await this.client.post<TimeEntryResponse>(
      `/projects/api/v3/tasks/${taskId}/time.json`,
      body
    );
    const parsed = TimeEntryResponseSchema.parse(response);
    return parsed.timelog;
  }

  /**
   * Update an existing time entry.
   */
  async update(timeEntryId: number, options: UpdateTimeEntryOptions): Promise<TimeEntry> {
    const body: UpdateTimeEntryRequest = {
      timelog: {},
    };

    if (options.minutes !== undefined) body.timelog.minutes = options.minutes;
    if (options.date !== undefined) body.timelog.date = options.date;
    if (options.description !== undefined) body.timelog.description = options.description;
    if (options.isBillable !== undefined) body.timelog.isBillable = options.isBillable;
    if (options.time !== undefined) body.timelog.time = options.time;
    if (options.tagIds !== undefined) body.timelog.tagIds = options.tagIds;

    const response = await this.client.patch<TimeEntryResponse>(
      `/projects/api/v3/time/${timeEntryId}.json`,
      body
    );
    const parsed = TimeEntryResponseSchema.parse(response);
    return parsed.timelog;
  }

  /**
   * Delete a time entry.
   */
  async delete(timeEntryId: number): Promise<void> {
    await this.client.delete(`/projects/api/v3/time/${timeEntryId}.json`);
  }

  /**
   * Helper: Create time entry from hours instead of minutes.
   */
  async logHours(
    projectId: number,
    hours: number,
    options: Omit<CreateTimeEntryOptions, 'minutes'>
  ): Promise<TimeEntry> {
    return this.create(projectId, {
      ...options,
      minutes: Math.round(hours * 60),
    });
  }

  /**
   * Helper: Log hours directly to a task.
   */
  async logHoursToTask(
    taskId: number,
    hours: number,
    options: Omit<CreateTimeEntryOptions, 'minutes' | 'taskId'>
  ): Promise<TimeEntry> {
    return this.createForTask(taskId, {
      ...options,
      minutes: Math.round(hours * 60),
    });
  }

  /**
   * Get total hours logged for a project.
   */
  async getTotalHours(projectId: number, options?: ListTimeEntriesOptions): Promise<number> {
    const entries = await this.listByProject(projectId, { ...options, pageSize: 500 });
    return entries.timelogs.reduce((sum, entry) => sum + entry.minutes / 60, 0);
  }

  /**
   * Get total billable hours for a project.
   */
  async getBillableHours(projectId: number, options?: ListTimeEntriesOptions): Promise<number> {
    const entries = await this.listByProject(projectId, {
      ...options,
      billableType: 'billable',
      pageSize: 500,
    });
    return entries.timelogs.reduce((sum, entry) => sum + entry.minutes / 60, 0);
  }
}
