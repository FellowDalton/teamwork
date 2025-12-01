/**
 * Teamwork API Client
 *
 * A comprehensive TypeScript client for Teamwork.com API v3.
 * Provides direct API access with workflow and stage support.
 *
 * @example
 * ```typescript
 * import { createTaskMonitor } from 'teamwork-api-client';
 *
 * const monitor = createTaskMonitor();
 *
 * // Get eligible tasks
 * const tasks = await monitor.getEligibleTasks(projectId, ['new', 'pending'], 10);
 *
 * // Claim and process task
 * await monitor.claimTask(taskId, adwId, { model: 'sonnet' });
 *
 * // Move task to stage
 * await monitor.moveTaskToStage(taskId, workflowId, 'In Progress');
 *
 * // Complete task
 * await monitor.completeTask(taskId, adwId, { commitHash: 'abc123' });
 * ```
 */

// Core client
import { TeamworkHttpClient as HttpClient, createClientFromEnv } from './client.ts';
export {
  TeamworkHttpClient,
  createClientFromEnv,
  type TeamworkClientConfig,
  type RequestOptions,
  type ApiError,
} from './client.ts';

// Type definitions
export * from './types.ts';

// Resource modules
import { TasksResource as Tasks } from './resources/tasks.ts';
import { WorkflowsResource as Workflows } from './resources/workflows.ts';
import { ProjectsResource as Projects } from './resources/projects.ts';
import { CommentsResource as Comments } from './resources/comments.ts';

export { TasksResource, type ListTasksOptions, type CreateTaskOptions, type UpdateTaskOptions } from './resources/tasks.ts';

export { WorkflowsResource, type ListWorkflowsOptions, type ListStageTasksOptions } from './resources/workflows.ts';

export { ProjectsResource, type ListProjectsOptions } from './resources/projects.ts';

export {
  CommentsResource,
  type ListCommentsOptions,
  type CreateCommentOptions,
  type AdwStatusUpdate,
} from './resources/comments.ts';

// High-level facade
export {
  TeamworkTaskMonitor,
  createTaskMonitor,
  type TaskMonitorConfig,
  // Tag/trigger parsing utilities
  extractInlineTags,
  parseNativeTags,
  detectExecutionTrigger,
  cleanTaskDescription,
  getTaskPromptForAgent,
} from './task-monitor.ts';

/**
 * Create a fully configured Teamwork API client.
 *
 * @example
 * ```typescript
 * const client = createTeamworkClient({
 *   apiUrl: 'https://your-site.teamwork.com',
 *   bearerToken: 'your-token',
 * });
 *
 * // Use individual resources
 * const tasks = await client.tasks.list({ statuses: ['new'] });
 * const workflows = await client.workflows.list({ include: ['stages'] });
 * ```
 */
export function createTeamworkClient(config: {
  apiUrl: string;
  bearerToken: string;
  debug?: boolean;
}) {
  const httpClient = new HttpClient(config);

  return {
    http: httpClient,
    tasks: new Tasks(httpClient),
    workflows: new Workflows(httpClient),
    projects: new Projects(httpClient),
    comments: new Comments(httpClient),
  };
}
