/**
 * High-level facade for task monitoring and management.
 * Provides drop-in replacement for MCP-based /get_teamwork_tasks and /update_teamwork_task.
 */

import { TeamworkHttpClient, createClientFromEnv, type TeamworkClientConfig } from './client.ts';
import { TasksResource } from './resources/tasks.ts';
import { WorkflowsResource } from './resources/workflows.ts';
import { ProjectsResource } from './resources/projects.ts';
import { CommentsResource, type AdwStatusUpdate } from './resources/comments.ts';
import { TimeEntriesResource } from './resources/time-entries.ts';
import { type ApiTask, type ProcessedTask, ProcessedTaskSchema } from './types.ts';

// ============================================================================
// Tag & Trigger Parsing
// ============================================================================

/**
 * Extract inline {{key: value}} tags from description.
 */
export function extractInlineTags(description: string): Record<string, string> {
  const pattern = /\{\{(\w+):\s*([^}]+)\}\}/g;
  const tags: Record<string, string> = {};
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(description)) !== null) {
    const [, key, value] = match;
    if (key && value) {
      tags[key.toLowerCase()] = value.trim();
    }
  }

  return tags;
}

/**
 * Parse native Teamwork tags (e.g., "prototype:vite_vue") into key-value pairs.
 * Note: Tags may have optional `name` field when returned as references.
 */
export function parseNativeTags(
  tags: Array<{ id: number; name?: string }>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const tag of tags) {
    // Skip tags without names (reference-only)
    if (!tag.name) continue;

    // Parse "key:value" format
    const colonIndex = tag.name.indexOf(':');
    if (colonIndex !== -1) {
      const key = tag.name.slice(0, colonIndex).toLowerCase().trim();
      const value = tag.name.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

/**
 * Detect execution trigger from description.
 * Returns 'execute', 'continue', or null.
 */
export function detectExecutionTrigger(description: string): {
  trigger: 'execute' | 'continue' | null;
  continuePrompt?: string;
} {
  const trimmed = description.trim();

  // Check for "continue - prompt" pattern
  const continueMatch = trimmed.match(/continue\s*-\s*(.+)$/is);
  if (continueMatch?.[1]) {
    return {
      trigger: 'continue',
      continuePrompt: continueMatch[1].trim(),
    };
  }

  // Check for "execute" at end of description
  if (/execute\s*$/i.test(trimmed)) {
    return { trigger: 'execute' };
  }

  return { trigger: null };
}

/**
 * Clean task description by removing tags and triggers.
 */
export function cleanTaskDescription(description: string): string {
  let cleaned = description;

  // Remove inline tags
  cleaned = cleaned.replace(/\{\{[^}]+\}\}/g, '');

  // Remove "execute" trigger
  cleaned = cleaned.replace(/execute\s*$/gi, '');

  // Remove "continue - prompt" trigger
  cleaned = cleaned.replace(/continue\s*-\s*.+$/gis, '');

  // Clean up whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Get clean task prompt for agent processing.
 */
export function getTaskPromptForAgent(
  description: string,
  executionTrigger: 'execute' | 'continue' | null,
  continuePrompt?: string
): string {
  if (executionTrigger === 'continue' && continuePrompt) {
    return continuePrompt;
  }
  return cleanTaskDescription(description);
}

// ============================================================================
// Task Monitor Facade
// ============================================================================

export interface TaskMonitorConfig extends Partial<TeamworkClientConfig> {
  /** Default project ID for operations */
  defaultProjectId?: number;
  /** Status mapping from system status to Teamwork status */
  statusMapping?: Record<string, string>;
}

/**
 * High-level task monitor for Teamwork integration.
 */
export class TeamworkTaskMonitor {
  private readonly client: TeamworkHttpClient;
  readonly tasks: TasksResource;
  readonly workflows: WorkflowsResource;
  readonly projects: ProjectsResource;
  readonly comments: CommentsResource;
  readonly timeEntries: TimeEntriesResource;

  private readonly defaultProjectId?: number;
  private readonly statusMapping: Record<string, string>;

  constructor(config?: TaskMonitorConfig) {
    // Create client from config or environment
    if (config?.apiUrl && config?.bearerToken) {
      this.client = new TeamworkHttpClient({
        apiUrl: config.apiUrl,
        bearerToken: config.bearerToken,
        debug: config.debug,
      });
    } else {
      this.client = createClientFromEnv(config?.debug);
    }

    // Initialize resource modules
    this.tasks = new TasksResource(this.client);
    this.workflows = new WorkflowsResource(this.client);
    this.projects = new ProjectsResource(this.client);
    this.comments = new CommentsResource(this.client);
    this.timeEntries = new TimeEntriesResource(this.client);

    // Configuration
    this.defaultProjectId = config?.defaultProjectId;
    this.statusMapping = config?.statusMapping ?? {
      'Not started': 'new',
      'In progress': 'active',
      Done: 'completed',
      'HIL Review': 'pending',
      Failed: 'pending',
    };
  }

  /**
   * Convert API task to processed task format (compatible with existing TeamworkTask schema).
   */
  processTask(apiTask: ApiTask, projectId: number): ProcessedTask {
    const description = apiTask.description ?? '';

    // Parse tags from native tags and inline tags
    const nativeTags = parseNativeTags(apiTask.tags ?? []);
    const inlineTags = extractInlineTags(description);

    // Merge tags (native takes precedence)
    const tags = { ...inlineTags, ...nativeTags };

    // Detect execution trigger
    const { trigger, continuePrompt } = detectExecutionTrigger(description);

    // Get task prompt
    const taskPrompt = getTaskPromptForAgent(description, trigger, continuePrompt);

    // Get assignee info - handle both object and array formats
    let assignedTo: string | null = null;
    if (apiTask.assignees) {
      if (Array.isArray(apiTask.assignees)) {
        // Array format: [{ id: number, type?: string }]
        const firstUser = apiTask.assignees.find((a) => a.type === 'users' || !a.type);
        assignedTo = firstUser?.id?.toString() ?? null;
      } else {
        // Object format: { userIds?: number[], teamIds?: number[], companyIds?: number[] }
        assignedTo = apiTask.assignees.userIds?.[0]?.toString() ?? null;
      }
    }

    return ProcessedTaskSchema.parse({
      task_id: String(apiTask.id),
      project_id: String(projectId),
      title: apiTask.name,
      status: apiTask.status ?? 'new',
      description,
      tags,
      worktree: tags['worktree'],
      model: tags['model'],
      workflow_type: tags['workflow'],
      prototype: tags['prototype'],
      execution_trigger: trigger ?? undefined,
      task_prompt: taskPrompt,
      assigned_to: assignedTo,
      created_time: apiTask.createdAt,
      last_edited_time: apiTask.updatedAt,
      due_date: apiTask.dueDate ?? null,
      priority: apiTask.priority,
      estimated_minutes: apiTask.estimatedMinutes,
      stage_id: apiTask.workflowColumn?.id,
      stage_name: apiTask.workflowColumn?.name,
    });
  }

  /**
   * Get eligible tasks for processing (replaces /get_teamwork_tasks).
   */
  async getEligibleTasks(
    projectId?: number,
    statusFilter: string[] = ['new', 'pending'],
    limit: number = 10
  ): Promise<ProcessedTask[]> {
    const pid = projectId ?? this.defaultProjectId;
    if (!pid) {
      throw new Error('Project ID is required');
    }

    // Fetch tasks with status filter
    const response = await this.tasks.listByProject(pid, {
      statuses: statusFilter,
      include: ['tags', 'assignees'],
      pageSize: limit,
    });

    // Process and filter eligible tasks
    const eligibleTasks: ProcessedTask[] = [];

    for (const apiTask of response.tasks) {
      const processed = this.processTask(apiTask, pid);

      // Check if task has valid execution trigger
      if (processed.execution_trigger === 'execute' || processed.execution_trigger === 'continue') {
        eligibleTasks.push(processed);
      }
    }

    return eligibleTasks.slice(0, limit);
  }

  /**
   * Map system status to Teamwork status.
   */
  mapStatusToTeamwork(systemStatus: string): string {
    return this.statusMapping[systemStatus] ?? systemStatus.toLowerCase();
  }

  /**
   * Update task status (replaces /update_teamwork_task).
   */
  async updateTaskStatus(
    taskId: string | number,
    status: string,
    metadata?: {
      adwId?: string;
      commitHash?: string;
      errorMessage?: string;
      message?: string;
      agentName?: string;
    }
  ): Promise<void> {
    const id = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    const teamworkStatus = this.mapStatusToTeamwork(status);

    // Update task status
    await this.tasks.update(id, { status: teamworkStatus });

    // Post status comment if metadata provided
    if (metadata?.adwId) {
      const update: AdwStatusUpdate = {
        adwId: metadata.adwId,
        status,
        commitHash: metadata.commitHash,
        errorMessage: metadata.errorMessage,
        message: metadata.message,
        agentName: metadata.agentName,
      };
      await this.comments.postAdwStatusUpdate(id, update);
    }
  }

  /**
   * Claim a task for processing.
   */
  async claimTask(
    taskId: string | number,
    adwId: string,
    metadata?: {
      model?: string;
      worktreeName?: string;
    }
  ): Promise<void> {
    const id = typeof taskId === 'string' ? parseInt(taskId) : taskId;

    // Update to "In progress" status
    await this.tasks.update(id, { status: 'active' });

    // Post claim comment
    const message = [
      'Task claimed for automated processing.',
      '',
      `- **Model**: ${metadata?.model ?? 'sonnet'}`,
      metadata?.worktreeName ? `- **Worktree**: ${metadata.worktreeName}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.comments.postAdwStatusUpdate(id, {
      adwId,
      status: 'In Progress',
      message,
    });
  }

  /**
   * Mark task as completed.
   */
  async completeTask(
    taskId: string | number,
    adwId: string,
    result: {
      commitHash?: string;
      message?: string;
    }
  ): Promise<void> {
    const id = typeof taskId === 'string' ? parseInt(taskId) : taskId;

    // Update to "completed" status
    await this.tasks.complete(id);

    // Post completion comment
    await this.comments.postAdwStatusUpdate(id, {
      adwId,
      status: 'Done',
      commitHash: result.commitHash,
      message: result.message ?? 'Task completed successfully.',
    });
  }

  /**
   * Mark task as failed.
   */
  async failTask(taskId: string | number, adwId: string, error: string | Error): Promise<void> {
    const id = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    const errorMessage = error instanceof Error ? error.message : error;

    // Update to "pending" status (used as blocked/failed state)
    await this.tasks.update(id, { status: 'pending' });

    // Post error comment
    await this.comments.postAdwStatusUpdate(id, {
      adwId,
      status: 'Failed',
      errorMessage,
    });
  }

  /**
   * Move task to a workflow stage.
   */
  async moveTaskToStage(taskId: string | number, workflowId: number, stageName: string): Promise<void> {
    const id = typeof taskId === 'string' ? parseInt(taskId) : taskId;

    // Find stage by name
    const stage = await this.workflows.findStageByName(workflowId, stageName);
    if (!stage) {
      throw new Error(`Stage "${stageName}" not found in workflow ${workflowId}`);
    }

    // Move task to stage
    await this.workflows.moveTaskToStage(id, workflowId, stage.id);
  }

  /**
   * Get workflow stages for a project.
   */
  async getProjectStages(projectId?: number): Promise<
    Array<{
      id: number;
      name: string;
      workflowId: number;
    }>
  > {
    const pid = projectId ?? this.defaultProjectId;
    if (!pid) {
      throw new Error('Project ID is required');
    }

    // Get project's active workflow
    const workflow = await this.projects.getActiveWorkflow(pid);
    if (!workflow) {
      return [];
    }

    // Get stages
    const stages = await this.workflows.getStages(workflow.id);
    return stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      workflowId: workflow.id,
    }));
  }

  /**
   * Get tasks by stage.
   */
  async getTasksByStage(
    workflowId: number,
    stageName?: string
  ): Promise<Map<string, ProcessedTask[]>> {
    const stages = await this.workflows.getStages(workflowId);
    const result = new Map<string, ProcessedTask[]>();

    // Get workflow to determine project
    const workflow = await this.workflows.get(workflowId);

    for (const stage of stages) {
      // Skip if specific stage requested and doesn't match
      if (stageName && stage.name.toLowerCase() !== stageName.toLowerCase()) {
        continue;
      }

      const response = await this.workflows.getStageTasks(workflowId, stage.id, {
        include: ['tags', 'assignees'],
      });

      // Process tasks - use a default project ID since workflow doesn't have direct project reference
      const projectId = this.defaultProjectId ?? 0;
      const processed = response.tasks.map((task) => this.processTask(task, projectId));
      result.set(stage.name, processed);
    }

    return result;
  }
}

/**
 * Create a task monitor from environment variables.
 */
export function createTaskMonitor(config?: Partial<TaskMonitorConfig>): TeamworkTaskMonitor {
  const defaultProjectId = process.env.TEAMWORK_PROJECT_ID
    ? parseInt(process.env.TEAMWORK_PROJECT_ID)
    : config?.defaultProjectId;

  return new TeamworkTaskMonitor({
    ...config,
    defaultProjectId,
  });
}
