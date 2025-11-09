#!/usr/bin/env bun
/**
 * Plan-Implement workflow with Teamwork task updates.
 *
 * Complex workflow: /plan → /implement → /update_teamwork_task
 * Supports prototype-specific planning commands.
 *
 * TypeScript/Bun port of adws/adw_plan_implement_update_teamwork_task.py
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
 */
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
      return stdout.trim().slice(0, 8); // First 8 characters
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Main workflow execution function.
 */
async function main(
  adwId: string,
  taskId: string,
  taskDescription: string,
  worktreeName: string,
  prototype: string = '',
  model: 'sonnet' | 'opus' = 'sonnet',
  _projectId?: string
): Promise<number> {
  // Setup logger
  const logger = await setupLogger(adwId, 'plan-implement-update-teamwork');

  logger.info('=== Starting Plan-Implement Workflow ===');
  logger.info(`ADW ID: ${adwId}`);
  logger.info(`Task ID: ${taskId}`);
  logger.info(`Worktree: ${worktreeName}`);
  logger.info(`Prototype: ${prototype || 'None'}`);
  logger.info(`Model: ${model}`);

  let workflowSuccess = false;
  let commitHash: string | null = null;
  let errorMessage: string | null = null;
  let planPath: string | null = null;
  let implementResponse: AgentPromptResponse | null = null;

  // Determine working directory
  const worktreePath = join(process.cwd(), '..', 'trees', worktreeName, 'tac8_app4__agentic_prototyping');
  const workingDir = await Bun.file(worktreePath).exists()
    ? worktreePath
    : process.cwd();

  logger.info(`Working directory: ${workingDir}`);

  try {
    // === Phase 1: Planning ===
    logger.info('=== Phase 1: Planning ===');

    const planCommand = getPlanCommand(prototype);
    logger.info(`Using planning command: ${planCommand}`);

    const planResponse = await executeTemplate({
      agentName: `plan-${worktreeName}`,
      slashCommand: planCommand,
      args: [adwId, taskDescription],
      adwId,
      model,
      workingDir,
    });

    if (!planResponse.success) {
      errorMessage = `Planning failed: ${planResponse.output}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    logger.info('Planning completed successfully');

    // Find the generated plan file
    const specsDir = join(workingDir, 'specs');
    if (await Bun.file(specsDir).exists()) {
      planPath = await findLatestPlanFile(specsDir);
      if (planPath) {
        logger.info(`Found plan file: ${planPath}`);
      } else {
        logger.warn('No plan file found in specs/');
      }
    } else {
      logger.warn('specs/ directory not found');
    }

    // === Phase 2: Implementation ===
    logger.info('=== Phase 2: Implementation ===');

    const implementArgs = planPath ? [adwId, planPath] : [adwId, taskDescription];

    implementResponse = await executeTemplate({
      agentName: `implement-${worktreeName}`,
      slashCommand: '/implement',
      args: implementArgs,
      adwId,
      model,
      workingDir,
    });

    if (!implementResponse.success) {
      errorMessage = `Implementation failed: ${implementResponse.output}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    logger.info('Implementation completed successfully');
    workflowSuccess = true;

    // Try to get commit hash
    commitHash = await getCurrentCommitHash(workingDir);
    if (commitHash) {
      logger.info(`Commit hash: ${commitHash}`);
    }
  } catch (error) {
    errorMessage = `Exception during workflow: ${error}`;
    logger.error(errorMessage);
  }

  // === Phase 3: Update Teamwork ===
  logger.info('=== Phase 3: Updating Teamwork ===');

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
    workflow: 'plan-implement-update',
    worktree_name: worktreeName,
    prototype: prototype || '',
    plan_path: planPath || '',
    result: implementResponse?.output || '',
  };

  // Execute update
  logger.info(`Updating Teamwork task to ${updateStatus}...`);

  const updateResponse = await executeTemplate({
    agentName: `teamwork-updater-${worktreeName}`,
    slashCommand: '/update_teamwork_task',
    args: [taskId, updateStatus, JSON.stringify(updateContent)],
    adwId,
    model,
    workingDir,
  });

  if (updateResponse.success) {
    logger.info(`Successfully updated Teamwork task ${taskId} to ${updateStatus}`);
  } else {
    logger.error(`Failed to update Teamwork task: ${updateResponse.output}`);
  }

  logger.info('=== Plan-Implement Workflow Complete ===');

  return workflowSuccess ? 0 : 1;
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 4) {
  console.error('Usage: adw-plan-implement-update-teamwork-task.ts <adw_id> <task_id> <task_description> <worktree_name> [prototype] [--model <model>] [--project-id <project_id>]');
  process.exit(1);
}

const adwId = args[0] as string;
const taskId = args[1] as string;
const taskDescription = args[2] as string;
const worktreeName = args[3] as string;
let prototype = args[4] || '';
let model: 'sonnet' | 'opus' = 'sonnet';
let projectId: string | undefined;

// Parse optional flags
for (let i = 5; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--model' && i + 1 < args.length) {
    const modelArg = args[i + 1];
    if (modelArg === 'opus' || modelArg === 'sonnet') {
      model = modelArg;
    }
    i++;
  } else if (arg === '--project-id' && i + 1 < args.length) {
    projectId = args[i + 1];
    i++;
  }
}

// Run the workflow
main(adwId, taskId, taskDescription, worktreeName, prototype, model, projectId)
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error(`Fatal error: ${error}`);
    process.exit(2);
  });
