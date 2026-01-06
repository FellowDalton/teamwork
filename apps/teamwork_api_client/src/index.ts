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
import { TimeEntriesResource as TimeEntries } from './resources/time-entries.ts';
import { PeopleResource as People } from './resources/people.ts';
import { ActivityResource as Activity } from './resources/activity.ts';
import { BudgetsResource as Budgets } from './resources/budgets.ts';
import { TagsResource as Tags } from './resources/tags.ts';
import { WebhooksResource as Webhooks } from './resources/webhooks.ts';

export { TasksResource, type ListTasksOptions, type CreateTaskOptions, type UpdateTaskOptions } from './resources/tasks.ts';

export { WorkflowsResource, type ListWorkflowsOptions, type ListStageTasksOptions } from './resources/workflows.ts';

export { ProjectsResource, type ListProjectsOptions, type CreateProjectOptions, type CreateTasklistOptions } from './resources/projects.ts';

export {
  CommentsResource,
  type ListCommentsOptions,
  type CreateCommentOptions,
  type AdwStatusUpdate,
} from './resources/comments.ts';

export {
  TimeEntriesResource,
  type ListTimeEntriesOptions,
  type CreateTimeEntryOptions,
  type UpdateTimeEntryOptions,
} from './resources/time-entries.ts';

export { PeopleResource } from './resources/people.ts';

export { ActivityResource, type ListActivityOptions } from './resources/activity.ts';

export { BudgetsResource, type ListProjectBudgetsOptions, type ListTasklistBudgetsOptions } from './resources/budgets.ts';

export { TagsResource, type Tag, type CreateTagOptions } from './resources/tags.ts';

export { 
  WebhooksResource, 
  type Webhook,
  type WebhookEventType,
  type WebhookEventAction,
  type CreateWebhookOptions,
  type ListWebhooksOptions,
} from './resources/webhooks.ts';

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
    timeEntries: new TimeEntries(httpClient),
    people: new People(httpClient),
    activity: new Activity(httpClient),
    budgets: new Budgets(httpClient),
    tags: new Tags(httpClient),
    webhooks: new Webhooks(httpClient),
  };
}
