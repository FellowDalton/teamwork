/**
 * Budgets resource module for Teamwork API.
 * Provides operations for project and tasklist budgets.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type ProjectBudget,
  type ProjectBudgetListResponse,
  type TasklistBudgetListResponse,
  ProjectBudgetListResponseSchema,
  TasklistBudgetListResponseSchema,
} from '../types.ts';

export interface ListProjectBudgetsOptions {
  /** Order by field */
  orderBy?: 'dateCreated';
  /** Order direction */
  orderMode?: 'asc' | 'desc';
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Include related data */
  include?: ('projects' | 'users')[];
}

export interface ListTasklistBudgetsOptions {
  /** Parent project budget ID */
  projectBudgetId?: number;
  /** Order by field */
  orderBy?: 'dateCreated';
  /** Order direction */
  orderMode?: 'asc' | 'desc';
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Include related data */
  include?: ('tasklists' | 'projectBudgets' | 'tasklistBudgetNotifications')[];
}

/**
 * Budgets resource for Teamwork API.
 */
export class BudgetsResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * List all budgets for a project.
   */
  async listByProject(projectId: number, options?: ListProjectBudgetsOptions): Promise<ProjectBudgetListResponse> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (options?.orderBy) {
      params['orderBy'] = options.orderBy;
    }
    if (options?.orderMode) {
      params['orderMode'] = options.orderMode;
    }
    if (options?.page !== undefined) {
      params['page'] = options.page;
    }
    if (options?.pageSize !== undefined) {
      params['pageSize'] = options.pageSize;
    }
    if (options?.include?.length) {
      params['include'] = options.include;
    }

    const response = await this.client.get<ProjectBudgetListResponse>(
      `/projects/api/v3/projects/${projectId}/budgets.json`,
      params
    );
    return ProjectBudgetListResponseSchema.parse(response);
  }

  /**
   * Get a single budget by ID.
   */
  async get(budgetId: number): Promise<ProjectBudget> {
    const response = await this.client.get<{ budget: ProjectBudget }>(
      `/projects/api/v3/projects/budgets/${budgetId}.json`
    );
    return response.budget;
  }

  /**
   * Get tasklist budgets for a specific project budget.
   */
  async getTasklistBudgets(budgetId: number, options?: ListTasklistBudgetsOptions): Promise<TasklistBudgetListResponse> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (options?.projectBudgetId !== undefined) {
      params['projectBudgetId'] = options.projectBudgetId;
    }
    if (options?.orderBy) {
      params['orderBy'] = options.orderBy;
    }
    if (options?.orderMode) {
      params['orderMode'] = options.orderMode;
    }
    if (options?.page !== undefined) {
      params['page'] = options.page;
    }
    if (options?.pageSize !== undefined) {
      params['pageSize'] = options.pageSize;
    }
    if (options?.include?.length) {
      params['include'] = options.include;
    }

    const response = await this.client.get<TasklistBudgetListResponse>(
      `/projects/api/v3/projects/budgets/${budgetId}/tasklists/budgets.json`,
      params
    );
    return TasklistBudgetListResponseSchema.parse(response);
  }

  /**
   * Get the active budget for a project (the most recent one).
   */
  async getActiveByProject(projectId: number): Promise<ProjectBudget | null> {
    const response = await this.listByProject(projectId, {
      orderBy: 'dateCreated',
      orderMode: 'desc',
      pageSize: 1,
    });
    return response.budgets[0] ?? null;
  }

  /**
   * Get budget utilization percentage for a project.
   */
  async getUtilization(projectId: number): Promise<{ budget: ProjectBudget; utilizationPercent: number } | null> {
    const budget = await this.getActiveByProject(projectId);
    if (!budget || !budget.capacity) {
      return null;
    }
    const used = budget.capacityUsed ?? 0;
    const utilizationPercent = (used / budget.capacity) * 100;
    return { budget, utilizationPercent };
  }
}
