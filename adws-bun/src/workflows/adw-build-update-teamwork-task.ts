#!/usr/bin/env bun
/**
 * Build workflow with Teamwork task updates.
 * TypeScript/Bun port of adws/adw_build_update_teamwork_task.py
 *
 * Simple workflow: /build → /update_teamwork_task
 *
 * Usage:
 *   ./src/workflows/adw-build-update-teamwork-task.ts <adw_id> <task_id> <task_description> <worktree_name> [model]
 *
 * Example:
 *   ./src/workflows/adw-build-update-teamwork-task.ts abc12345 12345 "Fix typo in README" feat-typo-fix sonnet
 */

import { join } from 'path';
import { executeTemplate } from '@/modules/agent';
import type { AgentPromptResponse } from '@/modules/data-models';
import { setupLogger, getLogger } from '@/modules/utils';

/**
 * Get the current git commit hash from a working directory
 */
async function getCommitHash(workingDir: string): Promise<string | null> {
  try {
    const proc = Bun.spawn({
      cmd: ['git', 'rev-parse', 'HEAD'],
      cwd: workingDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return null;
    }

    const hash = (await new Response(proc.stdout).text()).trim();
    return hash.slice(0, 8);
  } catch (error) {
    return null;
  }
}

/**
 * Main workflow execution
 */
async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error('Usage: adw-build-update-teamwork-task.ts <adw_id> <task_id> <task_description> <worktree_name> [model]');
    process.exit(1);
  }

  const adwId = args[0];
  const taskId = args[1];
  const taskDescription = args[2];
  const worktreeName = args[3];
  const model = args[4] || 'sonnet';

  // Validate required args
  if (!adwId || !taskId || !taskDescription || !worktreeName) {
    console.error('Missing required arguments');
    process.exit(1);
  }

  // Validate model
  if (model !== 'sonnet' && model !== 'opus') {
    console.error(`Invalid model: ${model}. Must be 'sonnet' or 'opus'`);
    process.exit(1);
  }

  // Setup logger
  await setupLogger(adwId, 'build_workflow');
  const logger = getLogger(adwId);

  logger.info('=== Starting Build Workflow ===');
  logger.info(`ADW ID: ${adwId}`);
  logger.info(`Task ID: ${taskId}`);
  logger.info(`Worktree: ${worktreeName}`);
  logger.info(`Model: ${model}`);

  let workflowSuccess = false;
  let commitHash: string | null = null;
  let errorMessage: string | null = null;
  let buildResponse: AgentPromptResponse | null = null;

  // Determine working directory
  const worktreePath = join(process.cwd(), '..', 'trees', worktreeName, 'tac8_app4__agentic_prototyping');
  let workingDir: string;

  try {
    // Check if worktree exists
    const worktreeFile = Bun.file(join(worktreePath, '.git'));
    if (await worktreeFile.exists() || await Bun.file(worktreePath).exists()) {
      workingDir = worktreePath;
      logger.info(`Using existing worktree: ${workingDir}`);
    } else {
      workingDir = process.cwd();
      logger.info(`Worktree not found, using current directory: ${workingDir}`);
    }
  } catch {
    workingDir = process.cwd();
    logger.info(`Worktree not found, using current directory: ${workingDir}`);
  }

  try {
    // Execute /build command
    logger.info('Executing /build command...');

    buildResponse = await executeTemplate({
      agentName: `build-${worktreeName}`,
      slashCommand: '/build',
      args: [taskDescription, '.'],
      adwId,
      model: model as 'sonnet' | 'opus',
      workingDir,
    });

    if (!buildResponse.success) {
      errorMessage = `Build failed: ${buildResponse.output}`;
      logger.error(errorMessage);
    } else {
      logger.info('Build completed successfully');
      workflowSuccess = true;

      // Try to get commit hash from git
      try {
        commitHash = await getCommitHash(workingDir);
        if (commitHash) {
          logger.info(`Commit hash: ${commitHash}`);
        }
      } catch (error: any) {
        logger.warn(`Could not get commit hash: ${error.message}`);
      }
    }
  } catch (error: any) {
    errorMessage = `Exception during build: ${error.message}`;
    logger.error(errorMessage);
  }

  // Determine final status
  const updateStatus = workflowSuccess && commitHash ? 'Done' : 'Failed';

  // Build result payload
  const updateContent = {
    status: updateStatus,
    adw_id: adwId,
    commit_hash: commitHash || '',
    error: errorMessage || '',
    timestamp: new Date().toISOString(),
    model,
    workflow: 'build-update',
    worktree_name: worktreeName,
    result: buildResponse?.output || '',
  };

  // Execute update
  logger.info(`Updating Teamwork task to ${updateStatus}...`);

  const updateResponse = await executeTemplate({
    agentName: `teamwork-updater-${worktreeName}`,
    slashCommand: '/update_teamwork_task',
    args: [taskId, updateStatus, JSON.stringify(updateContent)],
    adwId,
    model: model as 'sonnet' | 'opus',
    workingDir,
  });

  if (updateResponse.success) {
    logger.info(`Successfully updated Teamwork task ${taskId} to ${updateStatus}`);
  } else {
    logger.error(`Failed to update Teamwork task: ${updateResponse.output}`);
  }

  logger.info('=== Build Workflow Complete ===');

  // Exit with appropriate code
  process.exit(workflowSuccess ? 0 : 1);
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(2);
});
