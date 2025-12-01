/**
 * Data models for agent execution.
 * TypeScript/Bun port of core agent models from adws/adw_modules/data_models.py
 */

/**
 * Retry codes for Claude Code execution errors
 */
export enum RetryCode {
  CLAUDE_CODE_ERROR = 'claude_code_error', // General Claude Code CLI error
  TIMEOUT_ERROR = 'timeout_error', // Command timed out
  EXECUTION_ERROR = 'execution_error', // Error during execution
  ERROR_DURING_EXECUTION = 'error_during_execution', // Agent encountered an error
  NONE = 'none', // No retry needed
}

/**
 * Claude Code agent prompt configuration
 */
export interface AgentPromptRequest {
  prompt: string;
  adwId: string;
  agentName?: string;
  model: 'sonnet' | 'opus';
  dangerouslySkipPermissions?: boolean;
  outputFile: string;
  workingDir?: string;
}

/**
 * Claude Code agent response
 */
export interface AgentPromptResponse {
  output: string;
  success: boolean;
  sessionId: string | null;
  retryCode: RetryCode;
}

/**
 * Claude Code agent template execution request
 */
export interface AgentTemplateRequest {
  agentName: string;
  slashCommand: string;
  args: string[];
  adwId: string;
  model?: 'sonnet' | 'opus';
  workingDir?: string;
}

/**
 * Claude Code JSONL result message (last line)
 */
export interface ClaudeCodeResultMessage {
  type: string;
  subtype: string;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
}

// ============================================================================
// Additional models migrated from Python data_models.py
// ============================================================================

import { z } from 'zod';

// ============================================================================
// System Tags and Enums
// ============================================================================

/**
 * System-defined tags that control task execution behavior.
 */
export const SystemTag = {
  // Workflow selection tags
  PLAN_IMPLEMENT_UPDATE: 'adw_plan_implement_update_task',

  // Model selection tags
  OPUS: 'opus',
  SONNET: 'sonnet',
} as const;

export type SystemTagType = (typeof SystemTag)[keyof typeof SystemTag];

/**
 * Get all workflow-related tags.
 */
export function getWorkflowTags(): string[] {
  return [SystemTag.PLAN_IMPLEMENT_UPDATE];
}

/**
 * Get all model-related tags.
 */
export function getModelTags(): string[] {
  return [SystemTag.OPUS, SystemTag.SONNET];
}

/**
 * Extract the model to use from tags.
 * Priority: opus > sonnet > default (null)
 */
export function extractModelFromTags(tags: string[]): string | null {
  if (tags.includes(SystemTag.OPUS)) {
    return 'opus';
  } else if (tags.includes(SystemTag.SONNET)) {
    return 'sonnet';
  }
  return null;
}

/**
 * Check if full workflow should be used based on tags.
 */
export function extractWorkflowFromTags(tags: string[]): boolean {
  return tags.includes(SystemTag.PLAN_IMPLEMENT_UPDATE);
}

// ============================================================================
// Task Models
// ============================================================================

const TASK_STATUSES = ['[]', '[⏰]', '[🟡]', '[✅]', '[❌]'] as const;

/**
 * Represents a single task in the task list.
 */
export const TaskSchema = z.object({
  /** The task description */
  description: z.string(),
  /** Current status of the task */
  status: z.enum(TASK_STATUSES).default('[]'),
  /** ADW ID assigned when task is picked up */
  adw_id: z.string().optional(),
  /** Git commit hash when task is completed */
  commit_hash: z.string().optional(),
  /** Optional tags for the task */
  tags: z.array(z.string()).default([]),
  /** Associated git worktree name */
  worktree_name: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Check if task can be picked up by an agent.
 */
export function isTaskEligibleForPickup(task: Task): boolean {
  return task.status === '[]' || task.status === '[⏰]';
}

/**
 * Check if task is in a terminal state.
 */
export function isTaskCompleted(task: Task): boolean {
  return task.status === '[✅]' || task.status === '[❌]';
}

// ============================================================================
// Worktree Models
// ============================================================================

/**
 * Represents a git worktree section in the task list.
 */
export const WorktreeSchema = z.object({
  /** Name of the git worktree */
  name: z.string(),
  /** Tasks in this worktree */
  tasks: z.array(TaskSchema).default([]),
});

export type Worktree = z.infer<typeof WorktreeSchema>;

/**
 * Get all tasks eligible for pickup, considering blocking rules.
 */
export function getEligibleTasks(worktree: Worktree): Task[] {
  const eligible: Task[] = [];

  for (let i = 0; i < worktree.tasks.length; i++) {
    const task = worktree.tasks[i];
    if (!task) continue;

    if (task.status === '[]') {
      // Non-blocked tasks are always eligible
      eligible.push(task);
    } else if (task.status === '[⏰]') {
      // Blocked tasks are eligible only if all tasks above are successful
      const allAboveSuccessful = worktree.tasks.slice(0, i).every((t) => t && t.status === '[✅]');
      if (allAboveSuccessful) {
        eligible.push(task);
      }
    }
  }

  return eligible;
}

// ============================================================================
// Task Processing Models
// ============================================================================

/**
 * Task ready to be started by an agent.
 */
export const TaskToStartSchema = z.object({
  /** The task description */
  description: z.string(),
  /** Optional tags for the task */
  tags: z.array(z.string()).default([]),
});

export type TaskToStart = z.infer<typeof TaskToStartSchema>;

/**
 * Groups tasks by worktree for processing.
 */
export const WorktreeTaskGroupSchema = z.object({
  /** Name of the git worktree */
  worktree_name: z.string(),
  /** Tasks ready to be started in this worktree */
  tasks_to_start: z.array(TaskToStartSchema),
});

export type WorktreeTaskGroup = z.infer<typeof WorktreeTaskGroupSchema>;

/**
 * Response from the /process_tasks command.
 */
export const ProcessTasksResponseSchema = z.object({
  /** Tasks grouped by worktree */
  task_groups: z.array(WorktreeTaskGroupSchema).default([]),
});

export type ProcessTasksResponse = z.infer<typeof ProcessTasksResponseSchema>;

/**
 * Check if there are any tasks to process.
 */
export function hasTasksToProcess(response: ProcessTasksResponse): boolean {
  return response.task_groups.some((group) => group.tasks_to_start.length > 0);
}

// ============================================================================
// Task Update Models
// ============================================================================

const TASK_UPDATE_STATUSES = ['[✅]', '[❌]'] as const;

/**
 * Update information for a task after agent processing.
 */
export const TaskUpdateSchema = z
  .object({
    /** ADW ID of the task */
    adw_id: z.string(),
    /** Final status of the task */
    status: z.enum(TASK_UPDATE_STATUSES),
    /** Git commit hash if successful */
    commit_hash: z.string().optional(),
    /** Error message if failed */
    error_message: z.string().optional(),
    /** Worktree where task was executed */
    worktree_name: z.string(),
    /** Original task description */
    task_description: z.string(),
  })
  .refine(
    (data) => {
      // Ensure commit hash is provided for successful tasks
      if (data.status === '[✅]' && !data.commit_hash) {
        return false;
      }
      return true;
    },
    {
      message: 'Commit hash is required for successful tasks',
      path: ['commit_hash'],
    }
  );

export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;

// ============================================================================
// Workflow State Models
// ============================================================================

const WORKFLOW_PHASES = ['planning', 'implementing', 'updating', 'completed', 'failed'] as const;

/**
 * Tracks the state of a workflow execution.
 */
export const WorkflowStateSchema = z.object({
  /** Unique ADW ID for this workflow */
  adw_id: z.string(),
  /** Git worktree name */
  worktree_name: z.string(),
  /** Task being processed */
  task_description: z.string(),
  /** Current phase of the workflow */
  phase: z.enum(WORKFLOW_PHASES),
  /** Workflow start time */
  started_at: z.date().default(() => new Date()),
  /** Workflow completion time */
  completed_at: z.date().optional(),
  /** Path to generated plan file */
  plan_path: z.string().optional(),
  /** Error message if workflow failed */
  error: z.string().optional(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

/**
 * Mark workflow as completed.
 */
export function markWorkflowCompleted(
  state: WorkflowState,
  success: boolean = true,
  error?: string
): WorkflowState {
  return {
    ...state,
    completed_at: new Date(),
    phase: success ? 'completed' : 'failed',
    error: error || state.error,
  };
}

// ============================================================================
// Configuration Models
// ============================================================================

/**
 * Configuration for the cron trigger.
 */
export const CronTriggerConfigSchema = z.object({
  /** Polling interval in seconds */
  polling_interval: z.number().int().min(1).default(5),
  /** Run in dry-run mode without making changes */
  dry_run: z.boolean().default(false),
  /** Maximum number of concurrent tasks to process */
  max_concurrent_tasks: z.number().int().min(1).default(5),
  /** Path to the task list file */
  task_file_path: z.string().default('tasks.md'),
  /** Base directory for git worktrees */
  worktree_base_path: z.string().default('trees'),
});

export type CronTriggerConfig = z.infer<typeof CronTriggerConfigSchema>;

/**
 * Configuration for creating a new worktree.
 */
export const WorktreeConfigSchema = z.object({
  /** Name of the worktree to create */
  worktree_name: z.string(),
  /** Base branch to create worktree from */
  base_branch: z.string().default('main'),
  /** Whether to copy .env file to worktree */
  copy_env: z.boolean().default(true),
});

export type WorktreeConfig = z.infer<typeof WorktreeConfigSchema>;

// ============================================================================
// Notion-specific Models
// ============================================================================

const NOTION_STATUSES = ['Not started', 'In progress', 'Done', 'HIL Review', 'Failed'] as const;

/**
 * Represents a task from the Notion database.
 */
export const NotionTaskSchema = z.object({
  /** Notion page ID */
  page_id: z.string(),
  /** Task title/name */
  title: z.string(),
  /** Current task status */
  status: z.enum(NOTION_STATUSES),
  /** Page content blocks */
  content_blocks: z.array(z.record(z.string(), z.any())).default([]),
  /** Extracted tags from content {{key: value}} */
  tags: z.record(z.string(), z.string()).default({}),
  /** Target worktree name */
  worktree: z.string().optional(),
  /** Claude model preference (opus/sonnet) */
  model: z.string().optional(),
  /** Workflow to use (build/plan-implement) */
  workflow_type: z.string().optional(),
  /** Prototype type for app generation */
  prototype: z.string().optional(),
  /** Type of the last content block */
  last_block_type: z.string().optional(),
  /** Execution command (execute/continue) */
  execution_trigger: z.string().optional(),
  /** Extracted task prompt for agent processing */
  task_prompt: z.string().optional(),
  /** User assigned to this task */
  assigned_to: z.string().optional(),
  /** Task creation timestamp */
  created_time: z.date().optional(),
  /** Last modification timestamp */
  last_edited_time: z.date().optional(),
});

export type NotionTask = z.infer<typeof NotionTaskSchema>;

/**
 * Check if Notion task can be picked up for processing.
 */
export function isNotionTaskEligibleForProcessing(task: NotionTask): boolean {
  return (
    (task.status === 'Not started' || task.status === 'HIL Review') &&
    (task.execution_trigger === 'execute' || task.execution_trigger === 'continue')
  );
}

/**
 * Extract app context from Notion task tags.
 */
export function extractNotionAppContext(task: NotionTask): string | undefined {
  return task.tags.app;
}

/**
 * Get the preferred Claude model for Notion task, defaulting to sonnet.
 */
export function getNotionPreferredModel(task: NotionTask): string {
  const model = task.model || task.tags.model || 'sonnet';
  return model === 'opus' || model === 'sonnet' ? model : 'sonnet';
}

/**
 * Determine if Notion task should use plan-implement-update workflow.
 */
export function shouldNotionTaskUseFullWorkflow(task: NotionTask): boolean {
  return (
    task.workflow_type === 'plan' ||
    task.tags.workflow === 'plan' ||
    (task.task_prompt?.length || 0) > 500 // Complex tasks get full workflow
  );
}

// ============================================================================
// Notion Task Update Models
// ============================================================================

const NOTION_UPDATE_TYPES = ['status', 'content', 'progress', 'completion', 'error'] as const;

/**
 * Update payload for Notion task progress.
 */
export const NotionTaskUpdateSchema = z.object({
  /** Notion page ID to update */
  page_id: z.string(),
  /** New status value */
  status: z.enum(NOTION_STATUSES).optional(),
  /** Content blocks to append */
  content_blocks: z.array(z.record(z.string(), z.any())).default([]),
  /** Agent output to add as JSON block */
  agent_output: z.string().optional(),
  /** Type of update being made */
  update_type: z.enum(NOTION_UPDATE_TYPES),
  /** ADW ID for tracking */
  adw_id: z.string().optional(),
  /** Name of the agent making the update */
  agent_name: z.string().optional(),
  /** Session ID for debugging */
  session_id: z.string().optional(),
  /** Git commit hash for completion updates */
  commit_hash: z.string().optional(),
  /** Error message for failure updates */
  error_message: z.string().optional(),
});

export type NotionTaskUpdate = z.infer<typeof NotionTaskUpdateSchema>;

// ============================================================================
// Worktree Creation Request
// ============================================================================

/**
 * Request for automatic worktree creation.
 */
export const WorktreeCreationRequestSchema = z.object({
  /** Task description for context */
  task_description: z.string(),
  /** User-suggested worktree name */
  suggested_name: z.string().optional(),
  /** Base branch for worktree */
  base_branch: z.string().default('main'),
  /** App context for worktree creation */
  app_context: z.string().optional(),
  /** Prefix for worktree name generation */
  prefix: z.string().optional(),
});

export type WorktreeCreationRequest = z.infer<typeof WorktreeCreationRequestSchema>;

/**
 * Generate arguments for /make_worktree_name command.
 */
export function generateWorktreeNameArgs(request: WorktreeCreationRequest): string[] {
  return [request.task_description, request.app_context || '', request.prefix || ''];
}

// ============================================================================
// Notion Cron Configuration
// ============================================================================

/**
 * Configuration for Notion-based cron trigger.
 */
export const NotionCronConfigSchema = z.object({
  /** Notion database ID */
  database_id: z.string(),
  /** Polling interval in seconds */
  polling_interval: z.number().int().min(5).default(15),
  /** Maximum concurrent notion tasks */
  max_concurrent_tasks: z.number().int().min(1).max(10).default(3),
  /** Default Claude model */
  default_model: z.enum(['opus', 'sonnet']).default('sonnet'),
  /** Target apps directory */
  apps_directory: z.string().default('apps'),
  /** Base directory for worktrees */
  worktree_base_path: z.string().default('trees'),
  /** Run in dry-run mode without making changes */
  dry_run: z.boolean().default(false),
  /** Task statuses to poll for */
  status_filter: z.array(z.enum(NOTION_STATUSES)).default(['Not started', 'HIL Review']),
  /** Enable HIL (Human-in-the-Loop) review support */
  enable_hil_review: z.boolean().default(true),
});

export type NotionCronConfig = z.infer<typeof NotionCronConfigSchema>;

// ============================================================================
// Notion Workflow State
// ============================================================================

const NOTION_WORKFLOW_TYPES = ['build_update', 'plan_implement_update'] as const;
const NOTION_WORKFLOW_PHASES = [
  'starting',
  'planning',
  'implementing',
  'updating',
  'completed',
  'failed',
] as const;

/**
 * Tracks the state of a Notion-based workflow execution.
 */
export const NotionWorkflowStateSchema = z.object({
  /** Unique ADW ID for this workflow */
  adw_id: z.string(),
  /** Notion page ID */
  page_id: z.string(),
  /** Git worktree name */
  worktree_name: z.string(),
  /** Task being processed */
  task_description: z.string(),
  /** Type of workflow being executed */
  workflow_type: z.enum(NOTION_WORKFLOW_TYPES),
  /** Current phase of the workflow */
  phase: z.enum(NOTION_WORKFLOW_PHASES),
  /** Claude model being used */
  model: z.string(),
  /** Workflow start time */
  started_at: z.date().default(() => new Date()),
  /** Workflow completion time */
  completed_at: z.date().optional(),
  /** Path to generated plan file */
  plan_path: z.string().optional(),
  /** Final commit hash */
  commit_hash: z.string().optional(),
  /** Error message if workflow failed */
  error: z.string().optional(),
  /** Number of updates sent to Notion */
  notion_updates_count: z.number().int().default(0),
});

export type NotionWorkflowState = z.infer<typeof NotionWorkflowStateSchema>;

/**
 * Mark Notion workflow as completed.
 */
export function markNotionWorkflowCompleted(
  state: NotionWorkflowState,
  success: boolean = true,
  error?: string,
  commit_hash?: string
): NotionWorkflowState {
  return {
    ...state,
    completed_at: new Date(),
    phase: success ? 'completed' : 'failed',
    error: error || state.error,
    commit_hash: commit_hash || state.commit_hash,
  };
}

/**
 * Get Notion workflow duration in seconds.
 */
export function getNotionWorkflowDuration(state: NotionWorkflowState): number | null {
  if (state.completed_at) {
    return (state.completed_at.getTime() - state.started_at.getTime()) / 1000;
  }
  return null;
}

// ============================================================================
// Notion Agent Metrics
// ============================================================================

/**
 * Metrics for monitoring Notion agent performance.
 */
export const NotionAgentMetricsSchema = z.object({
  /** Total tasks processed */
  tasks_processed: z.number().int().default(0),
  /** Tasks completed successfully */
  tasks_completed: z.number().int().default(0),
  /** Tasks that failed */
  tasks_failed: z.number().int().default(0),
  /** Average time per task */
  average_processing_time: z.number().default(0.0),
  /** Total Notion API calls made */
  notion_api_calls: z.number().int().default(0),
  /** Notion API call failures */
  notion_api_errors: z.number().int().default(0),
  /** Worktrees created */
  worktrees_created: z.number().int().default(0),
  /** Last metrics reset time */
  last_reset: z.date().default(() => new Date()),
});

export type NotionAgentMetrics = z.infer<typeof NotionAgentMetricsSchema>;

/**
 * Calculate task success rate.
 */
export function calculateNotionSuccessRate(metrics: NotionAgentMetrics): number {
  const total = metrics.tasks_processed;
  return total > 0 ? (metrics.tasks_completed / total) * 100 : 0.0;
}

/**
 * Calculate Notion API success rate.
 */
export function calculateNotionApiSuccessRate(metrics: NotionAgentMetrics): number {
  const total = metrics.notion_api_calls;
  return total > 0 ? ((total - metrics.notion_api_errors) / total) * 100 : 100.0;
}

// ============================================================================
// Teamwork-specific Models
// ============================================================================

/**
 * Represents a task from Teamwork.
 */
export const TeamworkTaskSchema = z.object({
  /** Teamwork task ID */
  task_id: z.string(),
  /** Teamwork project ID */
  project_id: z.string(),
  /** Task title/name */
  title: z.string(),
  /** Current task status */
  status: z.string(),
  /** Task description text */
  description: z.string().default(''),
  /** Extracted tags (native + inline {{key: value}}) */
  tags: z.record(z.string(), z.string()).default({}),
  /** Target worktree name */
  worktree: z.string().optional(),
  /** Claude model preference (opus/sonnet) */
  model: z.string().optional(),
  /** Workflow to use (build/plan-implement) */
  workflow_type: z.string().optional(),
  /** Prototype type */
  prototype: z.string().optional(),
  /** Execution command (execute/continue) */
  execution_trigger: z.string().optional(),
  /** Extracted task prompt for agent processing */
  task_prompt: z.string().optional(),
  /** User assigned to this task */
  assigned_to: z.string().nullable().optional(),
  /** Task creation timestamp */
  created_time: z.string().optional(),
  /** Last modification timestamp */
  last_edited_time: z.string().optional(),
  /** Task due date */
  due_date: z.string().nullable().optional(),
  /** Task priority */
  priority: z.string().optional(),
  /** Estimated time in minutes */
  estimated_minutes: z.number().int().optional(),
});

export type TeamworkTask = z.infer<typeof TeamworkTaskSchema>;

/**
 * Check if Teamwork task is ready for agent processing.
 */
export function isTeamworkTaskEligibleForProcessing(task: TeamworkTask): boolean {
  const eligibleStatuses = ['new', 'to do', 'review'];
  return (
    task.status !== undefined &&
    eligibleStatuses.includes(task.status.toLowerCase()) &&
    (task.execution_trigger === 'execute' || task.execution_trigger === 'continue')
  );
}

/**
 * Extract inline {{key: value}} tags from Teamwork task description.
 */
export function extractTeamworkTagsFromDescription(description: string): Record<string, string> {
  const pattern = /\{\{(\w+):\s*([^}]+)\}\}/g;
  const tags: Record<string, string> = {};
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(description)) !== null) {
    const [, key, value] = match;
    if (key && value) {
      tags[key] = value.trim();
    }
  }

  return tags;
}

/**
 * Get the cleaned task prompt for agent execution.
 */
export function getTeamworkTaskPromptForAgent(task: TeamworkTask): string {
  if (task.execution_trigger === 'continue') {
    return task.task_prompt || '';
  } else {
    let desc = task.description;
    // Remove inline tags
    desc = desc.replace(/\{\{[^}]+\}\}/g, '');
    // Remove execute trigger
    desc = desc.replace(/execute/gi, '');
    return desc.trim();
  }
}

/**
 * Extract app context from Teamwork task tags.
 */
export function extractTeamworkAppContext(task: TeamworkTask): string | undefined {
  return task.tags.app;
}

/**
 * Get the preferred Claude model for Teamwork task, defaulting to sonnet.
 */
export function getTeamworkPreferredModel(task: TeamworkTask): string {
  const model = task.model || task.tags.model || 'sonnet';
  return model === 'opus' || model === 'sonnet' ? model : 'sonnet';
}

/**
 * Determine if Teamwork task should use plan-implement-update workflow.
 */
export function shouldTeamworkTaskUseFullWorkflow(task: TeamworkTask): boolean {
  return (
    task.workflow_type === 'plan' ||
    task.tags.workflow === 'plan' ||
    (task.task_prompt?.length || 0) > 500
  );
}

// ============================================================================
// Teamwork Task Update Models
// ============================================================================

const TEAMWORK_UPDATE_TYPES = ['status', 'comment', 'progress', 'completion', 'error'] as const;

/**
 * Update payload for Teamwork task status and comments.
 */
export const TeamworkTaskUpdateSchema = z.object({
  /** Teamwork task ID to update */
  task_id: z.string(),
  /** New status value */
  status: z.string().optional(),
  /** Comment text to post */
  comment_body: z.string().optional(),
  /** Type of update being made */
  update_type: z.enum(TEAMWORK_UPDATE_TYPES),
  /** ADW ID for tracking */
  adw_id: z.string().optional(),
  /** Name of the agent making the update */
  agent_name: z.string().optional(),
  /** Session ID for debugging */
  session_id: z.string().optional(),
  /** Git commit hash for completion updates */
  commit_hash: z.string().optional(),
  /** Error message for failure updates */
  error_message: z.string().optional(),
});

export type TeamworkTaskUpdate = z.infer<typeof TeamworkTaskUpdateSchema>;

/**
 * Format Teamwork update as comment markdown.
 */
export function formatTeamworkComment(update: TeamworkTaskUpdate): string {
  const emojiMap: Record<string, string> = {
    'In Progress': '🔄',
    Complete: '✅',
    Failed: '❌',
    Review: '👁️',
    Blocked: '🚫',
  };

  const emoji = update.status ? emojiMap[update.status] || 'ℹ️' : 'ℹ️';

  const lines = [
    `${emoji} **Status Update: ${update.status || 'Unknown'}**`,
    `- **ADW ID**: ${update.adw_id || 'N/A'}`,
    `- **Timestamp**: ${new Date().toISOString()}`,
  ];

  if (update.commit_hash) {
    lines.push(`- **Commit Hash**: ${update.commit_hash}`);
  }

  if (update.agent_name) {
    lines.push(`- **Agent**: ${update.agent_name}`);
  }

  lines.push('');
  lines.push('---');

  if (update.error_message) {
    lines.push(`**Error**: ${update.error_message}`);
  } else if (update.comment_body) {
    lines.push(update.comment_body);
  }

  return lines.join('\n');
}

// ============================================================================
// Teamwork Cron Configuration
// ============================================================================

/**
 * Configuration for Teamwork task monitoring cron job.
 */
export const TeamworkCronConfigSchema = z.object({
  /** Teamwork project ID */
  project_id: z.string(),
  /** Polling interval in seconds */
  polling_interval: z.number().int().min(5).default(15),
  /** Maximum concurrent tasks */
  max_concurrent_tasks: z.number().int().min(1).max(10).default(3),
  /** Default Claude model */
  default_model: z.enum(['opus', 'sonnet']).default('sonnet'),
  /** Target apps directory */
  apps_directory: z.string().default('apps'),
  /** Base directory for worktrees */
  worktree_base_path: z.string().default('trees'),
  /** Run in dry-run mode without making changes */
  dry_run: z.boolean().default(false),
  /** System status to Teamwork status mapping */
  status_mapping: z.record(z.string(), z.string()).default({
    'Not started': 'New',
    'In progress': 'In Progress',
    Done: 'Complete',
    'HIL Review': 'Review',
    Failed: 'Blocked',
  }),
  /** Teamwork statuses to poll for (case-insensitive) */
  status_filter: z.array(z.string()).default(['new', 'to do', 'review']),
  /** Enable HIL (Human-in-the-Loop) review support */
  enable_hil_review: z.boolean().default(true),
});

export type TeamworkCronConfig = z.infer<typeof TeamworkCronConfigSchema>;

/**
 * Get reverse mapping from Teamwork status to system status.
 */
export function getReverseStatusMapping(config: TeamworkCronConfig): Record<string, string> {
  return Object.fromEntries(Object.entries(config.status_mapping).map(([k, v]) => [v, k]));
}

/**
 * Convert system status to Teamwork status.
 */
export function mapStatusToTeamwork(config: TeamworkCronConfig, systemStatus: string): string {
  return config.status_mapping[systemStatus] || systemStatus;
}

/**
 * Convert Teamwork status to system status.
 */
export function mapStatusFromTeamwork(config: TeamworkCronConfig, teamworkStatus: string): string {
  const reverseMapping = getReverseStatusMapping(config);
  return reverseMapping[teamworkStatus] || teamworkStatus;
}

// ============================================================================
// Teamwork Workflow State
// ============================================================================

const TEAMWORK_WORKFLOW_TYPES = ['build_update', 'plan_implement_update'] as const;
const TEAMWORK_WORKFLOW_PHASES = [
  'starting',
  'planning',
  'implementing',
  'updating',
  'completed',
  'failed',
] as const;

/**
 * Tracks the state of a Teamwork-based workflow execution.
 */
export const TeamworkWorkflowStateSchema = z.object({
  /** Unique ADW ID for this workflow */
  adw_id: z.string(),
  /** Teamwork task ID */
  task_id: z.string(),
  /** Teamwork project ID */
  project_id: z.string(),
  /** Git worktree name */
  worktree_name: z.string(),
  /** Task being processed */
  task_description: z.string(),
  /** Type of workflow being executed */
  workflow_type: z.enum(TEAMWORK_WORKFLOW_TYPES),
  /** Current phase of the workflow */
  phase: z.enum(TEAMWORK_WORKFLOW_PHASES),
  /** Claude model being used */
  model: z.string(),
  /** Workflow start time */
  started_at: z.date().default(() => new Date()),
  /** Workflow completion time */
  completed_at: z.date().optional(),
  /** Path to generated plan file */
  plan_path: z.string().optional(),
  /** Final commit hash */
  commit_hash: z.string().optional(),
  /** Error message if workflow failed */
  error: z.string().optional(),
  /** Number of updates sent to Teamwork */
  teamwork_updates_count: z.number().int().default(0),
});

export type TeamworkWorkflowState = z.infer<typeof TeamworkWorkflowStateSchema>;

/**
 * Mark Teamwork workflow as completed.
 */
export function markTeamworkWorkflowCompleted(
  state: TeamworkWorkflowState,
  success: boolean = true,
  error?: string,
  commit_hash?: string
): TeamworkWorkflowState {
  return {
    ...state,
    completed_at: new Date(),
    phase: success ? 'completed' : 'failed',
    error: error || state.error,
    commit_hash: commit_hash || state.commit_hash,
  };
}

/**
 * Get Teamwork workflow duration in seconds.
 */
export function getTeamworkWorkflowDuration(state: TeamworkWorkflowState): number | null {
  if (state.completed_at) {
    return (state.completed_at.getTime() - state.started_at.getTime()) / 1000;
  }
  return null;
}

// ============================================================================
// Teamwork Agent Metrics
// ============================================================================

/**
 * Metrics for monitoring Teamwork agent performance.
 */
export const TeamworkAgentMetricsSchema = z.object({
  /** Total tasks processed */
  tasks_processed: z.number().int().default(0),
  /** Tasks completed successfully */
  tasks_completed: z.number().int().default(0),
  /** Tasks that failed */
  tasks_failed: z.number().int().default(0),
  /** Average time per task */
  average_processing_time: z.number().default(0.0),
  /** Total Teamwork API calls made */
  teamwork_api_calls: z.number().int().default(0),
  /** Teamwork API call failures */
  teamwork_api_errors: z.number().int().default(0),
  /** Worktrees created */
  worktrees_created: z.number().int().default(0),
  /** Last metrics reset time */
  last_reset: z.date().default(() => new Date()),
});

export type TeamworkAgentMetrics = z.infer<typeof TeamworkAgentMetricsSchema>;

/**
 * Calculate task success rate.
 */
export function calculateTeamworkSuccessRate(metrics: TeamworkAgentMetrics): number {
  const total = metrics.tasks_processed;
  return total > 0 ? (metrics.tasks_completed / total) * 100 : 0.0;
}

/**
 * Calculate Teamwork API success rate.
 */
export function calculateTeamworkApiSuccessRate(metrics: TeamworkAgentMetrics): number {
  const total = metrics.teamwork_api_calls;
  return total > 0 ? ((total - metrics.teamwork_api_errors) / total) * 100 : 100.0;
}
