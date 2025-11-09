#!/usr/bin/env bun
/**
 * Build workflow with Notion task updates.
 * TypeScript/Bun port of adws/adw_build_update_notion_task.py
 *
 * Simple workflow: /build → /update_notion_task
 *
 * Usage:
 *   ./src/workflows/adw-build-update-notion-task.ts --adw-id <adw_id> --worktree-name <worktree> --task <description> --page-id <page_id> [--model <model>] [--verbose]
 *
 * Example:
 *   ./src/workflows/adw-build-update-notion-task.ts --adw-id abc12345 --worktree-name feat-auth --task "Fix typo in README" --page-id 247fc382... --model sonnet
 */

import { join } from 'path';
import { parseArgs } from 'util';
import { executeTemplate } from '@/modules/agent';
import type { AgentPromptResponse } from '@/modules/data-models';
import { setupLogger, getLogger } from '@/modules/utils';

// Output file name constants
const SUMMARY_JSON = 'custom_summary_output.json';

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
    return hash.slice(0, 9); // Return first 9 characters (matching Python)
  } catch (error) {
    return null;
  }
}

/**
 * Sanitize worktree name to match valid pattern
 */
function sanitizeWorktreeName(name: string): string {
  // Look for a valid worktree name pattern in the input (5-20 lowercase alphanumeric + hyphens)
  const match = name.match(/([a-z][a-z0-9-]{4,19})/);
  if (match && match[1]) {
    return match[1];
  }

  // Clean up the name
  let cleaned = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
  cleaned = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned;
}

/**
 * Save phase summary to JSON file
 */
async function savePhaseSummary(
  adwId: string,
  agentName: string,
  data: Record<string, any>
): Promise<void> {
  const outputDir = join(process.cwd(), 'agents', adwId, agentName);
  const summaryPath = join(outputDir, SUMMARY_JSON);

  // Ensure directory exists
  await Bun.write(join(outputDir, '.gitkeep'), '');

  // Write summary
  await Bun.write(summaryPath, JSON.stringify(data, null, 2));
}

/**
 * Main workflow execution
 */
async function main() {
  // Parse CLI arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'adw-id': { type: 'string' },
      'worktree-name': { type: 'string' },
      task: { type: 'string' },
      'page-id': { type: 'string' },
      model: { type: 'string', default: 'sonnet' },
      verbose: { type: 'boolean', default: false },
    },
  });

  // Validate required arguments
  if (!values['adw-id'] || !values['worktree-name'] || !values.task || !values['page-id']) {
    console.error('Missing required arguments');
    console.error(
      'Usage: adw-build-update-notion-task.ts --adw-id <id> --worktree-name <name> --task <description> --page-id <id> [--model <model>] [--verbose]'
    );
    process.exit(1);
  }

  const adwId = values['adw-id'] as string;
  const pageId = values['page-id'] as string;
  const task = values.task as string;
  const model = (values.model as string) || 'sonnet';
  const verbose = values.verbose as boolean;

  // Validate model
  if (model !== 'sonnet' && model !== 'opus') {
    console.error(`Invalid model: ${model}. Must be 'sonnet' or 'opus'`);
    process.exit(1);
  }

  // Sanitize worktree name
  let worktreeName = sanitizeWorktreeName(values['worktree-name'] as string);

  // Setup logger
  await setupLogger(adwId, 'build_workflow');
  const logger = getLogger(adwId);

  logger.info('=== Notion Build-Update Workflow ===');
  logger.info(`ADW ID: ${adwId}`);
  logger.info(`Worktree: ${worktreeName}`);
  logger.info(`Task: ${task}`);
  logger.info(`Page ID: ${pageId}`);
  logger.info(`Model: ${model}`);

  // Calculate worktree paths
  const worktreeBasePath = join(process.cwd(), 'trees', worktreeName);
  const targetDirectory = 'tac8_app4__agentic_prototyping';
  const agentWorkingDir = join(worktreeBasePath, targetDirectory);

  // Check if worktree exists, create if needed
  try {
    const worktreeFile = Bun.file(worktreeBasePath);
    if (!(await worktreeFile.exists())) {
      logger.info(`Worktree not found at: ${worktreeBasePath}`);
      logger.info('Creating worktree now...');

      // Create worktree using the init_worktree command
      const initResponse = await executeTemplate({
        agentName: 'worktree-initializer',
        slashCommand: '/init_worktree',
        args: [worktreeName, targetDirectory],
        adwId,
        model: model as 'sonnet' | 'opus',
        workingDir: process.cwd(),
      });

      if (initResponse.success) {
        logger.info(`Worktree created successfully at: ${worktreeBasePath}`);
      } else {
        logger.error(`Failed to create worktree: ${initResponse.output}`);
        process.exit(1);
      }
    }
  } catch (error: any) {
    logger.warn(`Error checking worktree: ${error.message}`);
  }

  logger.info(`Working directory: ${agentWorkingDir}`);

  // Set agent names for each phase
  const builderName = `builder-${worktreeName}`;
  const updaterName = `notion-updater-${worktreeName}`;

  // Track workflow state
  let workflowSuccess = true;
  let commitHash: string | null = null;
  let errorMessage: string | null = null;

  // Phase 1: Run /build command
  logger.info('Phase 1: Build (/build)');

  let buildResponse: AgentPromptResponse;

  try {
    buildResponse = await executeTemplate({
      agentName: builderName,
      slashCommand: '/build',
      args: [adwId, task],
      adwId,
      model: model as 'sonnet' | 'opus',
      workingDir: agentWorkingDir,
    });

    if (buildResponse.success) {
      logger.info('Build completed successfully');
      if (verbose) {
        logger.info(buildResponse.output);
      }

      // Get the commit hash after successful build
      commitHash = await getCommitHash(agentWorkingDir);
      if (commitHash) {
        logger.info(`Commit hash: ${commitHash}`);
      }
    } else {
      workflowSuccess = false;
      errorMessage = `Build phase failed: ${buildResponse.output}`;
      logger.error(errorMessage);
    }

    // Save build phase summary
    await savePhaseSummary(adwId, builderName, {
      phase: 'build',
      adw_id: adwId,
      worktree_name: worktreeName,
      task,
      page_id: pageId,
      slash_command: '/build',
      args: [adwId, task],
      model,
      working_dir: agentWorkingDir,
      success: buildResponse.success,
      session_id: buildResponse.sessionId,
      commit_hash: commitHash,
    });
  } catch (error: any) {
    logger.error(`Exception during build: ${error.message}`);
    process.exit(2);
  }

  // Phase 2: Run /update_notion_task command (always run to update status)
  logger.info('Phase 2: Update Notion Task (/update_notion_task)');

  // Determine the status to update
  const updateStatus = workflowSuccess && commitHash ? 'Done' : 'Failed';

  // Build update content with results
  const updateContent = {
    status: updateStatus,
    adw_id: adwId,
    commit_hash: commitHash || '',
    error: errorMessage || '',
    timestamp: new Date().toISOString(),
    model,
    workflow: 'build-update',
    worktree_name: worktreeName,
    result: buildResponse.output,
  };

  try {
    const updateResponse = await executeTemplate({
      agentName: updaterName,
      slashCommand: '/update_notion_task',
      args: [pageId, updateStatus, JSON.stringify(updateContent)],
      adwId,
      model: model as 'sonnet' | 'opus',
      workingDir: process.cwd(),
    });

    if (updateResponse.success) {
      logger.info('Notion task updated successfully');
      if (verbose) {
        logger.info(updateResponse.output);
      }
    } else {
      logger.error(`Failed to update Notion task: ${updateResponse.output}`);
    }

    // Save update phase summary
    await savePhaseSummary(adwId, updaterName, {
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
    });

    // Create overall workflow summary
    const workflowSummaryPath = join(process.cwd(), 'agents', adwId, 'workflow_summary.json');
    await Bun.write(
      workflowSummaryPath,
      JSON.stringify(
        {
          workflow: 'build_update_notion_task',
          adw_id: adwId,
          worktree_name: worktreeName,
          task,
          page_id: pageId,
          model,
          working_dir: agentWorkingDir,
          commit_hash: commitHash,
          phases: {
            build: {
              success: buildResponse.success,
              session_id: buildResponse.sessionId,
              agent: builderName,
            },
            update_notion_task: {
              success: updateResponse.success,
              session_id: updateResponse.sessionId,
              agent: updaterName,
            },
          },
          overall_success: workflowSuccess,
          final_task_status: workflowSuccess && commitHash ? 'Done' : 'Failed',
        },
        null,
        2
      )
    );

    logger.info(`Workflow summary: ${workflowSummaryPath}`);

    // Exit with appropriate code
    if (workflowSuccess) {
      logger.info('Workflow completed successfully!');
      process.exit(0);
    } else {
      logger.warn('Workflow completed with errors');
      process.exit(1);
    }
  } catch (error: any) {
    logger.error(`Unexpected error: ${error.message}`);
    process.exit(2);
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(2);
});
