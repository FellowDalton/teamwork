#!/usr/bin/env bun
/**
 * Plan-Implement workflow with Notion task updates.
 *
 * This script runs three slash commands in sequence:
 * 1. /plan - Creates a plan based on the task description
 * 2. /implement - Implements the plan created by /plan
 * 3. /update_notion_task - Updates the Notion page with the result
 *
 * TypeScript/Bun port of adws/adw_plan_implement_update_notion_task.py
 */

import { join } from 'path';
import { executeTemplate } from '@/modules/agent';
import type { AgentPromptResponse } from '@/modules/data-models';
import { setupLogger } from '@/modules/utils';

/**
 * Map prototype type to corresponding plan command.
 */
function getPlanCommand(prototype?: string): string {
  const prototypeMap: Record<string, string> = {
    'vite_vue': '/plan_vite_vue',
    'uv_script': '/plan_uv_script',
    'bun_scripts': '/plan_bun_scripts',
    'uv_mcp': '/plan_uv_mcp',
  };

  return prototypeMap[prototype || ''] || '/plan';
}

/**
 * Find the most recently created plan file in specs directory.
 * Note: Currently not used as plan path is returned directly from plan command.
 * Kept for future use if needed.
 */
// @ts-ignore - Function intentionally unused but kept for future reference
async function findLatestPlanFile(specsDir: string): Promise<string | null> {
  try {
    const files: string[] = [];
    const glob = new Bun.Glob('plan-*.md');

    for await (const file of glob.scan({ cwd: specsDir })) {
      files.push(file);
    }

    if (files.length === 0) {
      return null;
    }

    // Get file stats and sort by modified time
    const filesWithStats = await Promise.all(
      files.map(async (file) => {
        const path = join(specsDir, file);
        const stat = await Bun.file(path).stat();
        return { path, mtime: stat.mtime };
      })
    );

    // Sort by mtime descending (most recent first)
    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return filesWithStats[0]?.path || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get current git commit hash.
 */
async function getCurrentCommitHash(workingDir: string): Promise<string | null> {
  try {
    const proc = Bun.spawn({
      cmd: ['git', 'rev-parse', 'HEAD'],
      cwd: workingDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const stdout = await new Response(proc.stdout).text();
      return stdout.trim().slice(0, 9); // First 9 characters (matches Python)
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract app name from task description.
 */
function extractAppName(task: string, adwId: string): string {
  const appNameMatch = task.toLowerCase().match(/app[:\s]+([a-z0-9-]+)/);
  return appNameMatch?.[1] || `app-${adwId.slice(0, 6)}`;
}

/**
 * Sanitize worktree name to valid format.
 */
function sanitizeWorktreeName(name: string): string {
  // Look for a valid worktree name pattern
  const match = name.match(/([a-z][a-z0-9-]{4,19})/);
  if (match?.[1]) {
    return match[1];
  }

  // Clean up the name
  let cleaned = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
  cleaned = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned;
}

/**
 * Main workflow execution function.
 */
async function main(
  adwId: string,
  worktreeName: string,
  task: string,
  pageId: string,
  model: 'sonnet' | 'opus' = 'sonnet',
  prototype?: string,
  _verbose: boolean = false
): Promise<number> {
  // Setup logger
  const logger = await setupLogger(adwId, 'plan-implement-update-notion');

  logger.info('=== Notion Plan-Implement-Update Workflow ===');
  logger.info(`ADW ID: ${adwId}`);
  logger.info(`Worktree: ${worktreeName}`);
  logger.info(`Task: ${task}`);
  logger.info(`Page ID: ${pageId}`);
  logger.info(`Model: ${model}`);
  if (prototype) {
    logger.info(`Prototype: ${prototype}`);
  }

  // Sanitize worktree name
  worktreeName = sanitizeWorktreeName(worktreeName);
  logger.info(`Sanitized worktree: ${worktreeName}`);

  // Calculate paths
  const worktreeBasePath = join(process.cwd(), 'trees', worktreeName);
  const targetDirectory = 'tac8_app4__agentic_prototyping';
  let agentWorkingDir = join(worktreeBasePath, targetDirectory);

  // Check if worktree exists, create if needed
  if (!(await Bun.file(worktreeBasePath).exists())) {
    logger.info(`Worktree not found at: ${worktreeBasePath}`);
    logger.info('Creating worktree now...');

    const initResponse = await executeTemplate({
      agentName: 'worktree-initializer',
      slashCommand: '/init_worktree',
      args: [worktreeName, targetDirectory],
      adwId,
      model,
      workingDir: process.cwd(),
    });

    if (initResponse.success) {
      logger.info(`Worktree created successfully at: ${worktreeBasePath}`);
      // Recalculate agent working dir after creation
      agentWorkingDir = join(worktreeBasePath, targetDirectory);
    } else {
      logger.error(`Failed to create worktree: ${initResponse.output}`);
      return 1;
    }
  }

  // Set agent names for each phase
  const plannerName = `planner-${worktreeName}`;
  const builderName = `builder-${worktreeName}`;
  const updaterName = `notion-updater-${worktreeName}`;

  // Track workflow state
  let workflowSuccess = true;
  let planPath: string | null = null;
  let commitHash: string | null = null;
  let errorMessage: string | null = null;
  let planResponse: AgentPromptResponse | null = null;
  let implementResponse: AgentPromptResponse | null = null;

  try {
    // === Phase 1: Planning ===
    logger.info('=== Phase 1: Planning ===');

    const appName = prototype ? extractAppName(task, adwId) : null;
    const planCommand = getPlanCommand(prototype);
    const planPhaseName = prototype ? `Prototype Planning (${planCommand})` : 'Planning (/plan)';

    logger.info(`Plan phase: ${planPhaseName}`);
    if (appName) {
      logger.info(`App name: ${appName}`);
    }

    const planArgs = [adwId, task];

    planResponse = await executeTemplate({
      agentName: plannerName,
      slashCommand: planCommand,
      args: planArgs,
      adwId,
      model,
      workingDir: agentWorkingDir,
    });

    if (planResponse.success) {
      planPath = planResponse.output.trim();

      // Validate plan path
      if (planPath && planPath.includes('specs/') && planPath.endsWith('.md')) {
        logger.info(`Plan created at: ${planPath}`);
      } else {
        workflowSuccess = false;
        errorMessage = `Invalid plan path returned: ${planPath}`;
        logger.error(errorMessage);
      }

      // Save plan phase summary
      await Bun.write(
        join(process.cwd(), 'agents', adwId, plannerName, 'custom_summary_output.json'),
        JSON.stringify(
          {
            phase: 'planning',
            adw_id: adwId,
            worktree_name: worktreeName,
            task,
            page_id: pageId,
            slash_command: planCommand,
            args: planArgs,
            model,
            prototype,
            app_name: appName,
            working_dir: agentWorkingDir,
            success: planResponse.success,
            session_id: planResponse.sessionId,
            plan_path: planPath,
          },
          null,
          2
        )
      );
    } else {
      workflowSuccess = false;
      errorMessage = `Planning phase failed: ${planResponse.output}`;
      logger.error(errorMessage);
    }

    // === Phase 2: Implementation ===
    if (workflowSuccess && planPath) {
      logger.info('=== Phase 2: Implementation ===');

      implementResponse = await executeTemplate({
        agentName: builderName,
        slashCommand: '/implement',
        args: [planPath],
        adwId,
        model,
        workingDir: agentWorkingDir,
      });

      if (implementResponse.success) {
        logger.info('Implementation completed successfully');

        // Get commit hash
        commitHash = await getCurrentCommitHash(agentWorkingDir);
        if (commitHash) {
          logger.info(`Commit hash: ${commitHash}`);
        }
      } else {
        workflowSuccess = false;
        errorMessage = `Implementation phase failed: ${implementResponse.output}`;
        logger.error(errorMessage);
      }

      // Save implement phase summary
      await Bun.write(
        join(process.cwd(), 'agents', adwId, builderName, 'custom_summary_output.json'),
        JSON.stringify(
          {
            phase: 'implementation',
            adw_id: adwId,
            worktree_name: worktreeName,
            task,
            page_id: pageId,
            slash_command: '/implement',
            args: [planPath],
            model,
            working_dir: agentWorkingDir,
            success: implementResponse.success,
            session_id: implementResponse.sessionId,
            commit_hash: commitHash,
          },
          null,
          2
        )
      );
    } else if (!workflowSuccess) {
      logger.info('Skipping implementation phase due to planning errors');
    }

    // === Phase 3: Update Notion Task ===
    logger.info('=== Phase 3: Update Notion Task ===');

    // Determine final status
    const updateStatus = workflowSuccess && commitHash ? 'Done' : 'Failed';

    // Build update content
    const updateContent = {
      status: updateStatus,
      adw_id: adwId,
      commit_hash: commitHash || '',
      error: errorMessage || '',
      timestamp: new Date().toISOString(),
      model,
      workflow: 'plan-implement-update',
      worktree_name: worktreeName,
      result: implementResponse?.output || planResponse?.output || '',
    };

    const updateResponse = await executeTemplate({
      agentName: updaterName,
      slashCommand: '/update_notion_task',
      args: [pageId, updateStatus, JSON.stringify(updateContent)],
      adwId,
      model,
      workingDir: process.cwd(),
    });

    if (updateResponse.success) {
      logger.info('Notion task updated successfully');
    } else {
      logger.error(`Failed to update Notion task: ${updateResponse.output}`);
    }

    // Save update phase summary
    await Bun.write(
      join(process.cwd(), 'agents', adwId, updaterName, 'custom_summary_output.json'),
      JSON.stringify(
        {
          phase: 'update_notion_task',
          adw_id: adwId,
          worktree_name: worktreeName,
          task,
          page_id: pageId,
          slash_command: '/update_notion_task',
          args: [pageId, updateStatus, JSON.stringify(updateContent)],
          model,
          working_dir: process.cwd(),
          success: updateResponse.success,
          session_id: updateResponse.sessionId,
          final_status: updateStatus,
          result: updateResponse.output,
        },
        null,
        2
      )
    );

    // Create overall workflow summary
    await Bun.write(
      join(process.cwd(), 'agents', adwId, 'workflow_summary.json'),
      JSON.stringify(
        {
          workflow: 'plan_implement_update_notion_task',
          adw_id: adwId,
          worktree_name: worktreeName,
          task,
          page_id: pageId,
          model,
          prototype,
          app_name: appName,
          working_dir: agentWorkingDir,
          plan_path: planPath,
          commit_hash: commitHash,
          phases: {
            planning: {
              success: planResponse?.success || false,
              session_id: planResponse?.sessionId || null,
              agent: plannerName,
            },
            implementation: planPath
              ? {
                  success: implementResponse?.success || false,
                  session_id: implementResponse?.sessionId || null,
                  agent: builderName,
                }
              : null,
            update_notion_task: {
              success: updateResponse.success,
              session_id: updateResponse.sessionId,
              agent: updaterName,
            },
          },
          overall_success: workflowSuccess,
          final_task_status: updateStatus,
        },
        null,
        2
      )
    );

    logger.info(`Workflow summary: agents/${adwId}/workflow_summary.json`);
    logger.info('=== Workflow Complete ===');

    return workflowSuccess ? 0 : 1;
  } catch (error) {
    logger.error(`Unexpected error: ${error}`);
    return 2;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

// Validate required arguments
let adwId: string | undefined;
let worktreeName: string | undefined;
let task: string | undefined;
let pageId: string | undefined;
let model: 'sonnet' | 'opus' = 'sonnet';
let prototype: string | undefined;
let verbose = false;

// Parse flags and arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--adw-id' && i + 1 < args.length) {
    adwId = args[++i];
  } else if (arg === '--worktree-name' && i + 1 < args.length) {
    worktreeName = args[++i];
  } else if (arg === '--task' && i + 1 < args.length) {
    task = args[++i];
  } else if (arg === '--page-id' && i + 1 < args.length) {
    pageId = args[++i];
  } else if (arg === '--model' && i + 1 < args.length) {
    const modelArg = args[++i];
    if (modelArg === 'opus' || modelArg === 'sonnet') {
      model = modelArg;
    }
  } else if (arg === '--prototype' && i + 1 < args.length) {
    prototype = args[++i];
  } else if (arg === '--verbose') {
    verbose = true;
  }
}

// Validate required arguments
if (!adwId || !worktreeName || !task || !pageId) {
  console.error('Usage: adw-plan-implement-update-notion-task.ts --adw-id <id> --worktree-name <name> --task <description> --page-id <id> [--model <sonnet|opus>] [--prototype <type>] [--verbose]');
  process.exit(1);
}

// Run the workflow (TypeScript knows these are defined here)
main(adwId as string, worktreeName as string, task as string, pageId as string, model, prototype, verbose)
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error(`Fatal error: ${error}`);
    process.exit(2);
  });
