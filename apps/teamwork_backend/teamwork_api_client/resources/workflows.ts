/**
 * Workflows resource module for Teamwork API.
 * Provides workflow and stage management operations.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type Workflow,
  type Stage,
  type WorkflowListResponse,
  type WorkflowResponse,
  type StageListResponse,
  type StageResponse,
  type TaskListResponse,
  type UpdateTaskPositionRequest,
  type AddTaskToStageRequest,
  WorkflowListResponseSchema,
  WorkflowResponseSchema,
  StageListResponseSchema,
  StageResponseSchema,
  TaskListResponseSchema,
} from '../types.ts';

export interface ListWorkflowsOptions {
  /** Filter by project IDs */
  projectIds?: number[];
  /** Filter by workflow IDs */
  workflowIds?: number[];
  /** Filter by stage names */
  stageNames?: string[];
  /** Search term */
  searchTerm?: string;
  /** Include related data */
  include?: ('stages' | 'projects' | 'users' | 'teams' | 'companies')[];
  /** Only return default workflow */
  onlyDefaultWorkflow?: boolean;
  /** Include archived workflows */
  includeArchived?: boolean;
  /** Include total count in response */
  includeTotalCount?: boolean;
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

export interface ListStageTasksOptions {
  /** Include related data */
  include?: ('tags' | 'assignees' | 'users' | 'teams')[];
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

/**
 * Workflows resource for Teamwork API.
 */
export class WorkflowsResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * List all workflows.
   */
  async list(options?: ListWorkflowsOptions): Promise<WorkflowListResponse> {
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    if (options?.projectIds?.length) {
      params['projectIds'] = options.projectIds.join(',');
    }
    if (options?.workflowIds?.length) {
      params['workflowIds'] = options.workflowIds.join(',');
    }
    if (options?.stageNames?.length) {
      params['stageNames'] = options.stageNames.join(',');
    }
    if (options?.searchTerm) {
      params['searchTerm'] = options.searchTerm;
    }
    if (options?.include?.length) {
      params['include'] = options.include;
    }
    if (options?.onlyDefaultWorkflow !== undefined) {
      params['onlyDefaultWorkflow'] = options.onlyDefaultWorkflow;
    }
    if (options?.includeArchived !== undefined) {
      params['includeArchived'] = options.includeArchived;
    }
    if (options?.includeTotalCount !== undefined) {
      params['includeTotalCount'] = options.includeTotalCount;
    }
    if (options?.page !== undefined) {
      params['page'] = options.page;
    }
    if (options?.pageSize !== undefined) {
      params['pageSize'] = options.pageSize;
    }

    const response = await this.client.get<WorkflowListResponse>('/projects/api/v3/workflows.json', params);
    return WorkflowListResponseSchema.parse(response);
  }

  /**
   * Get a single workflow by ID.
   */
  async get(workflowId: number, include?: ('stages' | 'projects')[]): Promise<Workflow> {
    const params: Record<string, string | string[] | undefined> = {};

    if (include?.length) {
      params['include'] = include;
    }

    const response = await this.client.get<WorkflowResponse>(
      `/projects/api/v3/workflows/${workflowId}.json`,
      params
    );
    const parsed = WorkflowResponseSchema.parse(response);
    return parsed.workflow;
  }

  /**
   * Get all stages for a workflow.
   */
  async getStages(workflowId: number): Promise<Stage[]> {
    const response = await this.client.get<StageListResponse>(
      `/projects/api/v3/workflows/${workflowId}/stages.json`
    );
    const parsed = StageListResponseSchema.parse(response);
    return parsed.stages;
  }

  /**
   * Get a specific stage.
   */
  async getStage(workflowId: number, stageId: number): Promise<Stage> {
    const response = await this.client.get<StageResponse>(
      `/projects/api/v3/workflows/${workflowId}/stages/${stageId}.json`
    );
    const parsed = StageResponseSchema.parse(response);
    return parsed.stage;
  }

  /**
   * Get tasks in a specific stage.
   */
  async getStageTasks(
    workflowId: number,
    stageId: number,
    options?: ListStageTasksOptions
  ): Promise<TaskListResponse> {
    const params: Record<string, string | number | string[] | undefined> = {};

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
      `/projects/api/v3/workflows/${workflowId}/stages/${stageId}/tasks.json`,
      params
    );
    return TaskListResponseSchema.parse(response);
  }

  /**
   * Get tasks in workflow backlog (not assigned to any stage).
   */
  async getBacklogTasks(workflowId: number, options?: ListStageTasksOptions): Promise<TaskListResponse> {
    const params: Record<string, string | number | string[] | undefined> = {};

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
      `/projects/api/v3/workflows/${workflowId}/backlog.json`,
      params
    );
    return TaskListResponseSchema.parse(response);
  }

  /**
   * Add tasks to a stage.
   * Uses the correct V3 API format with taskIds array.
   * @see https://apidocs.teamwork.com/guides/teamwork/workflows-api-getting-started-guide
   */
  async addTasksToStage(
    workflowId: number,
    stageId: number,
    taskIds: number[],
    _positionAfterCard?: number | null  // Not supported by V3 API
  ): Promise<void> {
    const body = {
      taskIds: taskIds,
    };

    await this.client.post(
      `/projects/api/v3/workflows/${workflowId}/stages/${stageId}/tasks.json`,
      body
    );
  }

  /**
   * Add a single task to a stage.
   */
  async addTaskToStage(
    workflowId: number,
    stageId: number,
    taskId: number,
    positionAfterCard?: number | null
  ): Promise<void> {
    await this.addTasksToStage(workflowId, stageId, [taskId], positionAfterCard);
  }

  /**
   * Move a task to a different stage.
   * Uses the same POST endpoint as addTasksToStage - the API handles both add and move.
   * @see https://apidocs.teamwork.com/guides/teamwork/workflows-api-getting-started-guide
   */
  async moveTaskToStage(
    taskId: number,
    workflowId: number,
    stageId: number,
    _positionAfterCard?: number | null  // Not supported by V3 API
  ): Promise<void> {
    // Moving is the same as adding - POST to target stage with taskIds
    await this.addTasksToStage(workflowId, stageId, [taskId]);
  }

  /**
   * Get workflows for a specific project.
   */
  async listByProject(projectId: number, include?: ('stages' | 'projects')[]): Promise<WorkflowListResponse> {
    return this.list({
      projectIds: [projectId],
      include,
    });
  }

  /**
   * Find a stage by name within a workflow.
   */
  async findStageByName(workflowId: number, stageName: string): Promise<Stage | null> {
    const stages = await this.getStages(workflowId);
    const lowerName = stageName.toLowerCase();
    return stages.find((stage) => stage.name.toLowerCase() === lowerName) ?? null;
  }

  /**
   * Get all tasks across all stages for a workflow.
   */
  async getAllWorkflowTasks(
    workflowId: number,
    options?: ListStageTasksOptions
  ): Promise<Map<number, TaskListResponse>> {
    const stages = await this.getStages(workflowId);
    const result = new Map<number, TaskListResponse>();

    for (const stage of stages) {
      const tasks = await this.getStageTasks(workflowId, stage.id, options);
      result.set(stage.id, tasks);
    }

    return result;
  }
}
