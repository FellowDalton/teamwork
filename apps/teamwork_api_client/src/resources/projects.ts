/**
 * Projects resource module for Teamwork API.
 * Provides project operations including workflow assignment.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type Project,
  type ProjectListResponse,
  type ProjectResponse,
  type TasklistListResponse,
  ProjectListResponseSchema,
  ProjectResponseSchema,
  TasklistListResponseSchema,
} from '../types.ts';

export interface ListProjectsOptions {
  /** Filter by project status */
  status?: 'active' | 'archived' | 'all';
  /** Filter by company ID */
  companyId?: number;
  /** Filter by category ID */
  categoryId?: number;
  /** Search term */
  searchTerm?: string;
  /** Include related data */
  include?: ('companies' | 'users' | 'categories')[];
  /** Include project counts */
  includeCounts?: boolean;
  /** Order by field */
  orderBy?: string;
  /** Order direction */
  orderMode?: 'asc' | 'desc';
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

/**
 * Projects resource for Teamwork API.
 */
export class ProjectsResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * List all projects.
   */
  async list(options?: ListProjectsOptions): Promise<ProjectListResponse> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (options?.status) {
      params['status'] = options.status;
    }
    if (options?.companyId !== undefined) {
      params['companyId'] = options.companyId;
    }
    if (options?.categoryId !== undefined) {
      params['categoryId'] = options.categoryId;
    }
    if (options?.searchTerm) {
      params['searchTerm'] = options.searchTerm;
    }
    if (options?.include?.length) {
      params['include'] = options.include;
    }
    if (options?.includeCounts !== undefined) {
      params['includeCounts'] = options.includeCounts;
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

    const response = await this.client.get<ProjectListResponse>('/projects/api/v3/projects.json', params);
    return ProjectListResponseSchema.parse(response);
  }

  /**
   * Get a single project by ID.
   */
  async get(projectId: number, include?: ('companies' | 'users' | 'categories')[]): Promise<Project> {
    const params: Record<string, string | string[] | undefined> = {};

    if (include?.length) {
      params['include'] = include;
    }

    const response = await this.client.get<ProjectResponse>(
      `/projects/api/v3/projects/${projectId}.json`,
      params
    );
    const parsed = ProjectResponseSchema.parse(response);
    return parsed.project;
  }

  /**
   * Get tasklists for a project.
   */
  async getTasklists(projectId: number): Promise<TasklistListResponse> {
    const response = await this.client.get<TasklistListResponse>(
      `/projects/api/v3/projects/${projectId}/tasklists.json`
    );
    return TasklistListResponseSchema.parse(response);
  }

  /**
   * Apply a workflow to a project.
   */
  async applyWorkflow(projectId: number, workflowId: number): Promise<void> {
    await this.client.post(`/projects/api/v3/projects/${projectId}/workflows.json`, {
      workflow: {
        id: workflowId,
      },
    });
  }

  /**
   * Remove a workflow from a project.
   */
  async removeWorkflow(projectId: number, workflowId: number): Promise<void> {
    await this.client.delete(`/projects/api/v3/projects/${projectId}/workflows/${workflowId}.json`);
  }

  /**
   * Update project workflow configuration.
   */
  async updateWorkflow(projectId: number, workflowId: number, config: Record<string, unknown>): Promise<void> {
    await this.client.patch(`/projects/api/v3/projects/${projectId}/workflows/${workflowId}.json`, {
      workflow: config,
    });
  }

  /**
   * Get the active workflow for a project.
   */
  async getActiveWorkflow(projectId: number): Promise<{ id: number; name?: string } | null> {
    const project = await this.get(projectId);
    return project.activeWorkflow ?? null;
  }

  /**
   * Search projects by name.
   */
  async searchByName(name: string, options?: Omit<ListProjectsOptions, 'searchTerm'>): Promise<Project[]> {
    const response = await this.list({
      ...options,
      searchTerm: name,
    });
    return response.projects;
  }

  /**
   * Get all active projects.
   */
  async listActive(options?: Omit<ListProjectsOptions, 'status'>): Promise<Project[]> {
    const response = await this.list({
      ...options,
      status: 'active',
    });
    return response.projects;
  }

  /**
   * Find a project by exact name match.
   */
  async findByName(name: string): Promise<Project | null> {
    const projects = await this.searchByName(name);
    const lowerName = name.toLowerCase();
    return projects.find((p) => p.name.toLowerCase() === lowerName) ?? null;
  }
}
