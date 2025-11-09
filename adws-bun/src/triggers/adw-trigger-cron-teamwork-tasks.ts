#!/usr/bin/env bun
/**
 * Teamwork Task Monitor - Continuous polling for agent-ready tasks.
 *
 * Monitors a Teamwork project for tasks with execution triggers and delegates them
 * to appropriate workflow scripts. Runs continuously with configurable polling interval.
 *
 * Usage:
 *   bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts [options]
 *   ./src/triggers/adw-trigger-cron-teamwork-tasks.ts [options]
 *
 * Options:
 *   --once           Run once and exit (no continuous monitoring)
 *   --dry-run        Run in dry-run mode without making changes
 *   --interval N     Polling interval in seconds (default: 15)
 *   --max-tasks N    Maximum concurrent tasks (default: 3)
 */

import { parseArgs } from 'util';
import { z } from 'zod';

// Import core modules
import { executeTemplate, generateShortId, getSafeSubprocessEnv } from '@/modules/agent';
import {
  type TeamworkTask,
  type TeamworkCronConfig,
  type AgentTemplateRequest,
  TeamworkTaskSchema,
  TeamworkCronConfigSchema,
  isTeamworkTaskEligibleForProcessing,
  getTeamworkPreferredModel,
  getTeamworkTaskPromptForAgent,
  shouldTeamworkTaskUseFullWorkflow,
  mapStatusToTeamwork,
} from '@/modules/data-models';
import { parseJson } from '@/modules/utils';

// ============================================================================
// Logger
// ============================================================================

const logger = {
  info: (...args: unknown[]) => {
    console.log(`[${new Date().toISOString()}] [INFO]`, ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(`[${new Date().toISOString()}] [WARN]`, ...args);
  },
  error: (...args: unknown[]) => {
    console.error(`[${new Date().toISOString()}] [ERROR]`, ...args);
  },
  debug: (...args: unknown[]) => {
    console.debug(`[${new Date().toISOString()}] [DEBUG]`, ...args);
  },
};

// ============================================================================
// Task Manager
// ============================================================================

class TeamworkTaskManager {
  private config: TeamworkCronConfig;
  private activeAdwIds: Set<string>;

  constructor(config: TeamworkCronConfig) {
    this.config = config;
    this.activeAdwIds = new Set();
  }

  /**
   * Fetch eligible tasks from Teamwork project.
   */
  async getEligibleTasks(limit: number = 10): Promise<TeamworkTask[]> {
    logger.info(`Fetching tasks from Teamwork project ${this.config.project_id}`);

    const request: AgentTemplateRequest = {
      agentName: 'teamwork-task-fetcher',
      slashCommand: '/get_teamwork_tasks',
      args: [this.config.project_id, JSON.stringify(this.config.status_filter), String(limit)],
      adwId: generateShortId(),
      model: 'sonnet',
      workingDir: process.cwd(),
    };

    try {
      const response = await executeTemplate(request);

      if (!response.success) {
        logger.error(`Failed to fetch Teamwork tasks: ${response.output}`);
        return [];
      }

      // Parse JSON response
      const taskData = parseJson(response.output, z.array(z.unknown()));
      if (!taskData || taskData.length === 0) {
        logger.info('No tasks returned from Teamwork');
        return [];
      }

      // Convert to TeamworkTask objects and filter eligible
      const tasks: TeamworkTask[] = [];
      for (const taskDict of taskData) {
        try {
          const teamworkTask = TeamworkTaskSchema.parse(taskDict);

          if (isTeamworkTaskEligibleForProcessing(teamworkTask)) {
            tasks.push(teamworkTask);
            logger.info(`Found eligible task: ${teamworkTask.task_id} - ${teamworkTask.title}`);
          } else {
            logger.debug(`Skipping ineligible task: ${teamworkTask.task_id}`);
          }
        } catch (error) {
          logger.error(`Failed to parse task: ${error}`);
          continue;
        }
      }

      return tasks;
    } catch (error) {
      logger.error('Exception while fetching tasks:', error);
      return [];
    }
  }

  /**
   * Update Teamwork task status and post comment.
   */
  async updateTaskStatus(taskId: string, status: string, updateContent: string = ''): Promise<boolean> {
    logger.info(`Updating task ${taskId} to status: ${status}`);

    // Map system status to Teamwork status
    const teamworkStatus = mapStatusToTeamwork(this.config, status);

    const request: AgentTemplateRequest = {
      agentName: 'teamwork-task-updater',
      slashCommand: '/update_teamwork_task',
      args: [taskId, teamworkStatus, updateContent],
      adwId: generateShortId(),
      model: 'sonnet',
      workingDir: process.cwd(),
    };

    try {
      const response = await executeTemplate(request);

      if (response.success) {
        logger.info(`Successfully updated task ${taskId} to ${teamworkStatus}`);
        return true;
      } else {
        logger.error(`Failed to update task ${taskId}: ${response.output}`);
        return false;
      }
    } catch (error) {
      logger.error(`Exception while updating task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Delegate task to appropriate workflow script.
   */
  async delegateTask(task: TeamworkTask): Promise<boolean> {
    // Generate ADW ID
    let adwId = generateShortId();

    // Check for duplicates
    if (this.activeAdwIds.has(adwId)) {
      logger.warn(`Duplicate ADW ID detected: ${adwId}, regenerating...`);
      adwId = generateShortId();
    }

    this.activeAdwIds.add(adwId);

    // Get model preference
    const model = getTeamworkPreferredModel(task);

    // Get worktree name
    let worktreeName = task.worktree || task.tags.worktree;
    if (!worktreeName) {
      worktreeName = this.generateWorktreeName(task);
    }

    // Get task prompt
    const taskPrompt = getTeamworkTaskPromptForAgent(task);

    logger.info(`Delegating task ${task.task_id} with ADW ID ${adwId}`);
    logger.info(`  Model: ${model}`);
    logger.info(`  Worktree: ${worktreeName}`);
    logger.info(`  Workflow: ${this.determineWorkflow(task)}`);

    // Claim task immediately
    const updateMetadata = {
      adw_id: adwId,
      timestamp: new Date().toISOString(),
      model,
      worktree_name: worktreeName,
      status: 'In progress',
    };

    const claimed = await this.updateTaskStatus(task.task_id, 'In progress', JSON.stringify(updateMetadata));

    if (!claimed) {
      logger.error(`Failed to claim task ${task.task_id}`);
      this.activeAdwIds.delete(adwId);
      return false;
    }

    // Determine workflow script and arguments
    let scriptPath: string;
    let scriptArgs: string[];

    if (task.prototype) {
      scriptPath = './adws-bun/src/workflows/adw-plan-implement-update-teamwork-task.ts';
      scriptArgs = [adwId, task.task_id, taskPrompt, worktreeName, task.prototype, model, this.config.project_id];
    } else if (shouldTeamworkTaskUseFullWorkflow(task)) {
      scriptPath = './adws-bun/src/workflows/adw-plan-implement-update-teamwork-task.ts';
      scriptArgs = [adwId, task.task_id, taskPrompt, worktreeName, '', model, this.config.project_id];
    } else {
      scriptPath = './adws-bun/src/workflows/adw-build-update-teamwork-task.ts';
      scriptArgs = [adwId, task.task_id, taskPrompt, worktreeName, model, this.config.project_id];
    }

    if (this.config.dry_run) {
      logger.info(`[DRY RUN] Would spawn: ${scriptPath} ${scriptArgs.join(' ')}`);
      return true;
    }

    // Spawn detached subprocess
    try {
      const proc = Bun.spawn({
        cmd: [scriptPath, ...scriptArgs],
        env: getSafeSubprocessEnv(),
        stdout: 'ignore',
        stderr: 'ignore',
        stdin: 'ignore',
        detached: true,
      });

      proc.unref(); // Allow parent to exit without waiting

      logger.info(`Successfully spawned workflow for task ${task.task_id}`);
      return true;
    } catch (error) {
      logger.error('Failed to spawn workflow:', error);

      // Update task to Failed status
      const errorMetadata = {
        adw_id: adwId,
        error: String(error),
        timestamp: new Date().toISOString(),
      };

      await this.updateTaskStatus(task.task_id, 'Failed', JSON.stringify(errorMetadata));

      this.activeAdwIds.delete(adwId);
      return false;
    }
  }

  /**
   * Determine which workflow to use for task.
   */
  private determineWorkflow(task: TeamworkTask): string {
    if (task.prototype) {
      return `plan-implement (${task.prototype})`;
    } else if (shouldTeamworkTaskUseFullWorkflow(task)) {
      return 'plan-implement';
    } else {
      return 'build';
    }
  }

  /**
   * Generate a worktree name from task title.
   */
  private generateWorktreeName(task: TeamworkTask): string {
    let name = task.title.toLowerCase();
    // Simple sanitization
    name = name.replace(/[^a-z0-9]+/g, '-');
    name = name.replace(/^-+|-+$/g, '');
    // Limit length
    if (name.length > 50) {
      name = name.slice(0, 50);
    }
    return task.prototype ? `proto-${name}` : `feat-${name}`;
  }

  /**
   * Run a single polling cycle. Returns number of tasks processed.
   */
  async runOnce(): Promise<number> {
    logger.info('=== Starting polling cycle ===');

    // Get eligible tasks
    const tasks = await this.getEligibleTasks(this.config.max_concurrent_tasks);

    if (tasks.length === 0) {
      logger.info('No eligible tasks found');
      return 0;
    }

    logger.info(`Found ${tasks.length} eligible task(s)`);

    // Delegate each task
    let processed = 0;
    for (const task of tasks) {
      if (await this.delegateTask(task)) {
        processed++;
      }
      await Bun.sleep(1000); // Brief delay between delegations
    }

    logger.info(`=== Polling cycle complete: ${processed}/${tasks.length} tasks delegated ===`);
    return processed;
  }

  /**
   * Run continuous polling loop.
   */
  async runContinuous(): Promise<void> {
    logger.info('Starting Teamwork task monitor');
    logger.info(`Project ID: ${this.config.project_id}`);
    logger.info(`Polling interval: ${this.config.polling_interval}s`);
    logger.info(`Max concurrent tasks: ${this.config.max_concurrent_tasks}`);
    logger.info(`Status filter: ${this.config.status_filter.join(', ')}`);
    logger.info(`Dry run: ${this.config.dry_run}`);

    let cycleCount = 0;

    // Set up signal handlers for graceful shutdown
    let shouldStop = false;

    const handleSignal = (signal: string) => {
      logger.info(`\nReceived ${signal} signal, shutting down gracefully...`);
      shouldStop = true;
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

    try {
      while (!shouldStop) {
        cycleCount++;
        logger.info(`\n--- Cycle ${cycleCount} ---`);

        await this.runOnce();

        if (shouldStop) break;

        logger.info(`Sleeping for ${this.config.polling_interval}s...`);
        await Bun.sleep(this.config.polling_interval * 1000);
      }
    } catch (error) {
      logger.error('Fatal error in polling loop:', error);
      throw error;
    }
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  // Parse CLI arguments
  const { values } = parseArgs({
    options: {
      once: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      interval: { type: 'string' },
      'max-tasks': { type: 'string' },
    },
    allowPositionals: false,
  });

  // Load configuration from environment
  const projectId = process.env.TEAMWORK_PROJECT_ID;
  if (!projectId) {
    logger.error('TEAMWORK_PROJECT_ID environment variable is required');
    process.exit(1);
  }

  // Build configuration
  const config: TeamworkCronConfig = TeamworkCronConfigSchema.parse({
    project_id: projectId,
    polling_interval: values.interval ? parseInt(values.interval) : 15,
    max_concurrent_tasks: values['max-tasks'] ? parseInt(values['max-tasks']) : 3,
    dry_run: values['dry-run'] || false,
  });

  // Create manager
  const manager = new TeamworkTaskManager(config);

  // Run
  if (values.once) {
    logger.info('Running in single-cycle mode');
    const processed = await manager.runOnce();
    logger.info(`Processed ${processed} task(s)`);
    process.exit(0);
  } else {
    await manager.runContinuous();
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}
