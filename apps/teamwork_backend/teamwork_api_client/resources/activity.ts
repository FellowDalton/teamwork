/**
 * Activity resource module for Teamwork API.
 * Provides access to activity feed and logs.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type Activity,
  type ActivityListResponse,
  ActivityListResponseSchema,
} from '../types.ts';

export interface ListActivityOptions {
  /** Filter by start datetime */
  startDate?: string;
  /** Filter by end datetime */
  endDate?: string;
  /** Filter by updated after date */
  updatedAfter?: string;
  /** Filter by user IDs */
  userIds?: number[];
  /** Filter by project IDs */
  projectIds?: number[];
  /** Filter by activity types */
  activityTypes?: (
    | 'task'
    | 'tasklist'
    | 'project'
    | 'message'
    | 'notebook'
    | 'milestone'
    | 'like'
    | 'file'
    | 'link'
    | 'task_comment'
    | 'milestone_comment'
    | 'file_comment'
    | 'comment'
  )[];
  /** Order mode */
  orderMode?: 'asc' | 'desc';
  /** Order by field */
  orderBy?: string;
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Include related data */
  include?: ('projects' | 'users' | 'companies')[];
  /** Only starred projects */
  onlyStarredProjects?: boolean;
  /** Include archived projects */
  includeArchivedProjects?: boolean;
  /** Include deleted items */
  showDeleted?: boolean;
}

/**
 * Activity resource for Teamwork API.
 */
export class ActivityResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * Build query params from options.
   */
  private buildParams(options?: ListActivityOptions): Record<string, string | number | boolean | string[] | undefined> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (!options) return params;

    if (options.startDate) params['startDate'] = options.startDate;
    if (options.endDate) params['endDate'] = options.endDate;
    if (options.updatedAfter) params['updatedAfter'] = options.updatedAfter;
    if (options.userIds?.length) params['userIds'] = options.userIds.join(',');
    if (options.projectIds?.length) params['projectIds'] = options.projectIds.join(',');
    if (options.activityTypes?.length) params['activityTypes'] = options.activityTypes.join(',');
    if (options.orderMode) params['orderMode'] = options.orderMode;
    if (options.orderBy) params['orderBy'] = options.orderBy;
    if (options.page !== undefined) params['page'] = options.page;
    if (options.pageSize !== undefined) params['pageSize'] = options.pageSize;
    if (options.include?.length) params['include'] = options.include;
    if (options.onlyStarredProjects !== undefined) params['onlyStarredProjects'] = options.onlyStarredProjects;
    if (options.includeArchivedProjects !== undefined) params['includeArchivedProjects'] = options.includeArchivedProjects;
    if (options.showDeleted !== undefined) params['showDeleted'] = options.showDeleted;

    return params;
  }

  /**
   * Get latest activity across all projects.
   */
  async list(options?: ListActivityOptions): Promise<ActivityListResponse> {
    const params = this.buildParams(options);
    const response = await this.client.get<ActivityListResponse>(
      '/projects/api/v3/latestactivity.json',
      params
    );
    return ActivityListResponseSchema.parse(response);
  }

  /**
   * Get activity for a specific user.
   */
  async listByUser(userId: number, options?: Omit<ListActivityOptions, 'userIds'>): Promise<ActivityListResponse> {
    return this.list({
      ...options,
      userIds: [userId],
    });
  }

  /**
   * Get activity for a specific project.
   */
  async listByProject(projectId: number, options?: Omit<ListActivityOptions, 'projectIds'>): Promise<ActivityListResponse> {
    return this.list({
      ...options,
      projectIds: [projectId],
    });
  }

  /**
   * Get task-related activity (tasks and task comments).
   */
  async listTaskActivity(options?: Omit<ListActivityOptions, 'activityTypes'>): Promise<ActivityListResponse> {
    return this.list({
      ...options,
      activityTypes: ['task', 'task_comment'],
    });
  }

  /**
   * Get activity for a user within a date range.
   * Convenience method for status reporting.
   */
  async getUserActivityForPeriod(
    userId: number,
    startDate: string,
    endDate: string,
    options?: Omit<ListActivityOptions, 'userIds' | 'startDate' | 'endDate'>
  ): Promise<Activity[]> {
    const response = await this.list({
      ...options,
      userIds: [userId],
      startDate,
      endDate,
      orderMode: 'desc',
      pageSize: 500,
    });
    return response.activities;
  }
}
