#!/usr/bin/env bun
/**
 * Notion Task Monitor - Continuous polling for agent-ready tasks.
 *
 * Monitors a Notion database for tasks with execution triggers and delegates them
 * to appropriate workflow scripts. Runs continuously with configurable polling interval.
 *
 * Usage:
 *   bun run src/triggers/adw-trigger-cron-notion-tasks.ts [options]
 *   ./src/triggers/adw-trigger-cron-notion-tasks.ts [options]
 *
 * Options:
 *   --once             Run once and exit (no continuous monitoring)
 *   --dry-run          Run in dry-run mode without making changes
 *   --interval N       Polling interval in seconds (default: 15)
 *   --max-tasks N      Maximum concurrent tasks (default: 3)
 *   --database-id ID   Notion database ID (default: from NOTION_AGENTIC_TASK_TABLE_ID)
 *   --status-filter    JSON array of statuses to filter (default: ["Not started", "HIL Review"])
 */

import { parseArgs } from 'util';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { z } from 'zod';

// Import core modules
import { executeTemplate, generateShortId, getSafeSubprocessEnv } from '@/modules/agent';
import {
  type NotionTask,
  type NotionCronConfig,
  type AgentTemplateRequest,
  NotionTaskSchema,
  NotionCronConfigSchema,
  isNotionTaskEligibleForProcessing,
  getNotionPreferredModel,
  shouldNotionTaskUseFullWorkflow,
} from '@/modules/data-models';
import { parseJson } from '@/modules/utils';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DATABASE_ID = process.env.NOTION_AGENTIC_TASK_TABLE_ID || '';
const TARGET_DIRECTORY = 'tac8_app4__agentic_prototyping';

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

class NotionTaskManager {
  private databaseId: string;

  constructor(databaseId: string) {
    this.databaseId = databaseId;
  }

  /**
   * Get eligible tasks from Notion database.
   */
  async getEligibleTasks(statusFilter: string[] = ['Not started', 'HIL Review'], limit: number = 10): Promise<NotionTask[]> {
    try {
      const request: AgentTemplateRequest = {
        agentName: 'notion-task-fetcher',
        slashCommand: '/get_notion_tasks',
        args: [this.databaseId, JSON.stringify(statusFilter), String(limit)],
        adwId: generateShortId(),
        model: 'sonnet',
        workingDir: process.cwd(),
      };

      const response = await executeTemplate(request);
      if (!response.success) {
        logger.error(`Failed to get Notion tasks: ${response.output}`);
        return [];
      }

      // Parse the JSON response
      const taskData = parseJson(response.output, z.array(z.unknown()));
      if (!taskData || taskData.length === 0) {
        logger.info('No tasks returned from Notion');
        return [];
      }

      // Convert to NotionTask objects
      const tasks: NotionTask[] = [];
      for (const taskDict of taskData) {
        try {
          const notionTask = NotionTaskSchema.parse(taskDict);
          if (isNotionTaskEligibleForProcessing(notionTask)) {
            tasks.push(notionTask);
          }
        } catch (error) {
          logger.warn(`Failed to parse task ${(taskDict as Record<string, unknown>)?.page_id || 'unknown'}:`, error);
        }
      }

      return tasks;
    } catch (error) {
      logger.error('Error getting eligible Notion tasks:', error);
      return [];
    }
  }

  /**
   * Update a Notion task status.
   */
  async updateTaskStatus(pageId: string, status: string, updateContent: string = ''): Promise<boolean> {
    try {
      const request: AgentTemplateRequest = {
        agentName: 'notion-task-updater',
        slashCommand: '/update_notion_task',
        args: [pageId, status, updateContent],
        adwId: generateShortId(),
        model: 'sonnet',
        workingDir: process.cwd(),
      };

      const response = await executeTemplate(request);
      if (response.success) {
        return true;
      } else {
        logger.error(`Failed to update Notion task status: ${response.output}`);
        return false;
      }
    } catch (error) {
      logger.error('Error updating Notion task status:', error);
      return false;
    }
  }

  /**
   * Generate a worktree name using /make_worktree_name command.
   */
  async generateWorktreeName(taskDescription: string, prefix: string = ''): Promise<string | null> {
    try {
      const request: AgentTemplateRequest = {
        agentName: 'worktree-namer',
        slashCommand: '/make_worktree_name',
        args: [taskDescription, prefix],
        adwId: generateShortId(),
        model: 'sonnet',
        workingDir: process.cwd(),
      };

      const response = await executeTemplate(request);
      if (response.success) {
        const worktreeName = response.output.trim();
        logger.info(`Generated worktree name: ${worktreeName}`);
        return worktreeName;
      } else {
        logger.error('Failed to generate worktree name');
        return null;
      }
    } catch (error) {
      logger.error('Error generating worktree name:', error);
      return null;
    }
  }
}

// ============================================================================
// Cron Trigger
// ============================================================================

interface CronTriggerStats {
  checks: number;
  tasks_started: number;
  worktrees_created: number;
  notion_updates: number;
  errors: number;
  last_check: string | null;
}

class NotionCronTrigger {
  private config: NotionCronConfig;
  private taskManager: NotionTaskManager;
  private stats: CronTriggerStats;

  constructor(config: NotionCronConfig) {
    this.config = config;
    this.taskManager = new NotionTaskManager(config.database_id);
    this.stats = {
      checks: 0,
      tasks_started: 0,
      worktrees_created: 0,
      notion_updates: 0,
      errors: 0,
      last_check: null,
    };
  }

  /**
   * Check if a worktree already exists.
   */
  checkWorktreeExists(worktreeName: string): boolean {
    const worktreePath = resolve(this.config.worktree_base_path, worktreeName);
    return existsSync(worktreePath);
  }

  /**
   * Create a new worktree using the init_worktree command.
   */
  async createWorktree(worktreeName: string): Promise<boolean> {
    if (this.config.dry_run) {
      logger.info(`[DRY RUN] Would create worktree '${worktreeName}'`);
      return true;
    }

    try {
      const request: AgentTemplateRequest = {
        agentName: 'worktree-creator',
        slashCommand: '/init_worktree',
        args: [worktreeName, TARGET_DIRECTORY],
        adwId: generateShortId(),
        model: 'sonnet',
        workingDir: process.cwd(),
      };

      const response = await executeTemplate(request);
      if (response.success) {
        this.stats.worktrees_created++;
        logger.info(`✓ Created worktree: ${worktreeName} → ${TARGET_DIRECTORY}`);
        return true;
      } else {
        logger.error(`Failed to create worktree: ${worktreeName}`);
        this.stats.errors++;
        return false;
      }
    } catch (error) {
      logger.error('Error creating worktree:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delegate a Notion task to the appropriate workflow.
   */
  async delegateTask(task: NotionTask, worktreeName: string, adwId: string): Promise<void> {
    // Determine workflow and model
    const useFullWorkflow = shouldNotionTaskUseFullWorkflow(task) || task.prototype !== undefined;
    const model = getNotionPreferredModel(task);

    if (this.config.dry_run) {
      const workflowType = useFullWorkflow ? 'plan-implement-update' : 'build-update';
      logger.info(`[DRY RUN] Would delegate task '${task.title}' (page: ${task.page_id.slice(0, 8)}...) with ADW ID ${adwId} using ${workflowType} workflow with ${model} model`);
      return;
    }

    try {
      // Determine which workflow script to use
      let workflowScript: string;
      let workflowType: string;

      if (useFullWorkflow) {
        workflowScript = './adws-bun/src/workflows/adw-plan-implement-update-notion-task.ts';
        workflowType = 'plan-implement-update';
      } else {
        workflowScript = './adws-bun/src/workflows/adw-build-update-notion-task.ts';
        workflowType = 'build-update';
      }

      // Build the command to run the workflow
      const combinedTask = task.task_prompt ? `${task.title}: ${task.task_prompt}` : task.title;
      const cmd = [workflowScript, '--adw-id', adwId, '--worktree-name', worktreeName, '--task', combinedTask, '--page-id', task.page_id, '--model', model];

      // Add prototype flag if specified
      if (task.prototype) {
        cmd.push('--prototype', task.prototype);
      }

      logger.info(`🤖 Executing Notion Agent`);
      logger.info(`  Page ID: ${task.page_id}`);
      logger.info(`  Title: ${task.title}`);
      logger.info(`  Workflow: ${workflowType}`);
      logger.info(`  ADW ID: ${adwId}`);
      logger.info(`  Worktree: ${worktreeName}`);
      logger.info(`  Model: ${model}`);

      // Run the workflow in a subprocess
      const proc = Bun.spawn({
        cmd,
        env: getSafeSubprocessEnv(),
        stdout: 'ignore',
        stderr: 'ignore',
        stdin: 'ignore',
        detached: true,
      });

      proc.unref(); // Allow parent to exit without waiting

      this.stats.tasks_started++;
      logger.info(`✅ Task delegated with ADW ID: ${adwId}`);
    } catch (error) {
      logger.error('Error delegating Notion task:', error);
      this.stats.errors++;
    }
  }

  /**
   * Main task processing logic for Notion tasks.
   */
  async processTasks(): Promise<void> {
    this.stats.checks++;
    this.stats.last_check = new Date().toISOString();

    // Get eligible tasks from Notion
    const eligibleTasks = await this.taskManager.getEligibleTasks(this.config.status_filter, this.config.max_concurrent_tasks);

    if (eligibleTasks.length === 0) {
      logger.info("No eligible tasks found in Notion database. Add tasks with 'execute' or 'continue -' triggers.");
      return;
    }

    logger.info(`🚀 Processing ${eligibleTasks.length} Notion Task${eligibleTasks.length !== 1 ? 's' : ''}`);
    for (const task of eligibleTasks) {
      logger.info(`  • ${task.title}`);
      logger.info(`    Status: ${task.status} | Trigger: ${task.execution_trigger} | Page: ${task.page_id.slice(0, 12)}...`);
    }

    // Process each task
    for (const task of eligibleTasks) {
      try {
        // Generate ADW ID for this task
        const adwId = generateShortId();

        // IMMEDIATELY update task status to "In progress" in Notion
        if (!this.config.dry_run) {
          const updateContent = {
            status: 'In progress',
            adw_id: adwId,
            timestamp: new Date().toISOString(),
            trigger: task.execution_trigger,
            previous_status: task.status,
          };

          const success = await this.taskManager.updateTaskStatus(task.page_id, 'In progress', JSON.stringify(updateContent));

          if (!success) {
            logger.error(`Failed to update Notion task status: ${task.title}`);
            this.stats.errors++;
            continue;
          }

          this.stats.notion_updates++;
          logger.info(`✅ Task Claimed: ${task.title} (In progress)`);
        } else {
          logger.info(`[DRY RUN] Would update Notion task '${task.title}' to 'In progress' with ADW ID ${adwId}`);
        }

        // Generate or extract worktree name
        let worktreeName: string | null = task.worktree || null;
        if (!worktreeName) {
          worktreeName = await this.taskManager.generateWorktreeName(task.task_prompt || task.title, 'task');
          if (!worktreeName) {
            logger.error(`Failed to generate worktree name for task: ${task.title}`);
            if (!this.config.dry_run) {
              await this.taskManager.updateTaskStatus(task.page_id, 'Failed', 'Failed to generate worktree name');
            }
            continue;
          }
        }

        // Check if worktree exists, create if needed
        if (!this.checkWorktreeExists(worktreeName)) {
          logger.info(`ℹ️ Worktree '${worktreeName}' doesn't exist, creating...`);
          if (!(await this.createWorktree(worktreeName))) {
            if (!this.config.dry_run) {
              await this.taskManager.updateTaskStatus(task.page_id, 'Failed', 'Failed to create worktree');
            }
            continue;
          }
        }

        // Delegate task to appropriate workflow
        await this.delegateTask(task, worktreeName, adwId);

        // Respect max concurrent tasks limit
        if (this.stats.tasks_started >= this.config.max_concurrent_tasks) {
          logger.warn(`⚠️ Reached max concurrent tasks (${this.config.max_concurrent_tasks})`);
          break;
        }
      } catch (error) {
        logger.error('Error processing Notion task:', error);
        this.stats.errors++;
        continue;
      }
    }
  }

  /**
   * Create a status display.
   */
  displayStatus(): void {
    logger.info('🔄 Notion Multi-Agent Cron Status:');
    logger.info(`  Polling Interval: ${this.config.polling_interval} seconds`);
    logger.info(`  Notion Database: ${this.config.database_id.slice(0, 12)}...`);
    logger.info(`  Status Filter: ${this.config.status_filter.join(', ')}`);
    logger.info(`  Max Concurrent: ${this.config.max_concurrent_tasks}`);
    logger.info(`  Dry Run: ${this.config.dry_run ? 'Yes' : 'No'}`);
    logger.info('');
    logger.info(`  Checks: ${this.stats.checks}`);
    logger.info(`  Tasks Started: ${this.stats.tasks_started}`);
    logger.info(`  Worktrees Created: ${this.stats.worktrees_created}`);
    logger.info(`  Notion Updates: ${this.stats.notion_updates}`);
    logger.info(`  Errors: ${this.stats.errors}`);
    logger.info(`  Last Check: ${this.stats.last_check || 'Never'}`);
  }

  /**
   * Run the task check once and exit.
   */
  async runOnce(): Promise<void> {
    this.displayStatus();
    logger.info('\nRunning single Notion check...\n');
    await this.processTasks();
    logger.info('\n✅ Single Notion check completed');
  }

  /**
   * Run continuously with scheduled checks.
   */
  async runContinuous(): Promise<void> {
    this.displayStatus();
    logger.info(`\nStarted monitoring Notion tasks every ${this.config.polling_interval} seconds`);
    logger.info('Press Ctrl+C to stop\n');

    let shouldStop = false;

    const handleSignal = (signal: string) => {
      logger.info(`\nReceived ${signal} signal, stopping Notion cron trigger...`);
      shouldStop = true;
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

    try {
      while (!shouldStop) {
        await this.processTasks();

        if (shouldStop) break;

        await Bun.sleep(this.config.polling_interval * 1000);
      }

      this.displayStatus();
      logger.info('✅ Notion cron trigger stopped');
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
      'database-id': { type: 'string' },
      'status-filter': { type: 'string' },
    },
    allowPositionals: false,
  });

  // Load database ID from CLI or environment
  const databaseId = values['database-id'] || DEFAULT_DATABASE_ID;
  if (!databaseId) {
    logger.error('No Notion database ID configured!');
    logger.error('Please set the NOTION_AGENTIC_TASK_TABLE_ID environment variable in your .env file');
    logger.error('or provide it via --database-id option.');
    process.exit(1);
  }

  // Parse status filter
  let statusFilter: string[];
  try {
    if (values['status-filter']) {
      const parsed = JSON.parse(values['status-filter']);
      if (!Array.isArray(parsed)) {
        throw new Error('Status filter must be a JSON array');
      }
      statusFilter = parsed;
    } else {
      statusFilter = ['Not started', 'HIL Review'];
    }
  } catch (error) {
    logger.error(`Error parsing status filter: ${error}`);
    logger.warn("Using default: ['Not started', 'HIL Review']");
    statusFilter = ['Not started', 'HIL Review'];
  }

  // Build configuration
  const config: NotionCronConfig = NotionCronConfigSchema.parse({
    database_id: databaseId,
    polling_interval: values.interval ? parseInt(values.interval) : 15,
    dry_run: values['dry-run'] || false,
    max_concurrent_tasks: values['max-tasks'] ? parseInt(values['max-tasks']) : 3,
    status_filter: statusFilter,
  });

  // Create and run the trigger
  const trigger = new NotionCronTrigger(config);

  if (values.once) {
    await trigger.runOnce();
  } else {
    await trigger.runContinuous();
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}
