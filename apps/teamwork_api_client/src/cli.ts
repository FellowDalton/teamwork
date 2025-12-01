#!/usr/bin/env bun
/**
 * CLI tool for testing Teamwork API client.
 *
 * Usage:
 *   bun run src/cli.ts <command> [args...]
 *
 * Commands:
 *   list-tasks <project_id> [status]    - List tasks (status: new, active, completed)
 *   get-task <task_id>                  - Get a specific task
 *   list-workflows                      - List all workflows
 *   list-stages <workflow_id>           - List stages for a workflow
 *   stage-tasks <workflow_id> <stage_id> - List tasks in a stage
 *   move-task <task_id> <workflow_id> <stage_id> - Move task to stage
 *   update-status <task_id> <status>    - Update task status
 *   eligible-tasks <project_id>         - Get eligible tasks for processing
 *   list-projects [status]              - List projects (status: active, archived, all)
 */

import { parseArgs } from 'util';
import { createClientFromEnv, TeamworkHttpClient } from './client.ts';
import { TasksResource } from './resources/tasks.ts';
import { WorkflowsResource } from './resources/workflows.ts';
import { ProjectsResource } from './resources/projects.ts';
import { createTaskMonitor } from './task-monitor.ts';

// Command definitions
const COMMANDS = {
  'list-tasks': 'List tasks in a project',
  'get-task': 'Get a specific task by ID',
  'list-workflows': 'List all workflows',
  'list-stages': 'List stages for a workflow',
  'stage-tasks': 'List tasks in a stage',
  'move-task': 'Move task to a stage',
  'update-status': 'Update task status',
  'eligible-tasks': 'Get eligible tasks for automated processing',
  'list-projects': 'List all projects',
  help: 'Show this help message',
};

function printHelp(): void {
  console.log(`
Teamwork API Client CLI

Usage:
  bun run src/cli.ts <command> [args...]

Commands:`);

  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(20)} ${desc}`);
  }

  console.log(`
Examples:
  bun run src/cli.ts list-projects
  bun run src/cli.ts list-tasks 123456 new
  bun run src/cli.ts list-workflows
  bun run src/cli.ts list-stages 789
  bun run src/cli.ts eligible-tasks 123456
  bun run src/cli.ts update-status 999 completed

Environment Variables:
  TEAMWORK_API_URL       - Teamwork API URL (e.g., https://yoursite.teamwork.com)
  TEAMWORK_BEARER_TOKEN  - API Bearer token
  TEAMWORK_PROJECT_ID    - Default project ID (optional)
`);
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const cmdArgs = args.slice(1);

  // Initialize client
  let client: TeamworkHttpClient;
  try {
    client = createClientFromEnv(true); // Enable debug mode
  } catch (error) {
    console.error('Error initializing client:', (error as Error).message);
    console.error('\nMake sure TEAMWORK_API_URL and TEAMWORK_BEARER_TOKEN are set.');
    process.exit(1);
  }

  const tasks = new TasksResource(client);
  const workflows = new WorkflowsResource(client);
  const projects = new ProjectsResource(client);

  try {
    switch (command) {
      case 'list-projects': {
        const status = (cmdArgs[0] as 'active' | 'archived' | 'all') || 'active';
        console.log(`Listing ${status} projects...`);
        const response = await projects.list({ status, pageSize: 50 });
        console.log(`\nFound ${response.projects.length} projects:\n`);
        for (const project of response.projects) {
          console.log(`  [${project.id}] ${project.name}`);
          if (project.description) {
            console.log(`      ${project.description.slice(0, 80)}...`);
          }
        }
        break;
      }

      case 'list-tasks': {
        const projectIdArg = cmdArgs[0];
        if (!projectIdArg) {
          console.error('Error: project_id is required');
          process.exit(1);
        }
        const projectId = parseInt(projectIdArg);
        if (isNaN(projectId)) {
          console.error('Error: project_id must be a number');
          process.exit(1);
        }
        const status = cmdArgs[1] || undefined;
        console.log(`Listing tasks for project ${projectId}${status ? ` with status ${status}` : ''}...`);
        const response = await tasks.listByProject(projectId, {
          statuses: status ? [status] : undefined,
          include: ['tags'],
          pageSize: 50,
        });
        console.log(`\nFound ${response.tasks.length} tasks:\n`);
        // Build tag lookup from included section
        const tagLookup: Record<string, string> = {};
        if (response.included?.tags) {
          for (const [id, tag] of Object.entries(response.included.tags)) {
            if (tag.name) tagLookup[id] = tag.name;
          }
        }
        for (const task of response.tasks) {
          // Resolve tag names from task.tags (references) using included lookup
          const tagNames =
            task.tags
              ?.map((t) => t.name || tagLookup[String(t.id)] || `#${t.id}`)
              .filter(Boolean)
              .join(', ') || 'none';
          console.log(`  [${task.id}] ${task.name}`);
          console.log(`      Status: ${task.status}, Tags: ${tagNames}`);
        }
        break;
      }

      case 'get-task': {
        const taskIdArg = cmdArgs[0];
        if (!taskIdArg) {
          console.error('Error: task_id is required');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }
        console.log(`Getting task ${taskId}...`);
        const task = await tasks.get(taskId, ['tags', 'assignees']);
        console.log('\nTask details:');
        console.log(formatJson(task));
        break;
      }

      case 'list-workflows': {
        console.log('Listing workflows...');
        const response = await workflows.list({ include: ['stages'] });
        console.log(`\nFound ${response.workflows.length} workflows:\n`);
        for (const workflow of response.workflows) {
          console.log(`  [${workflow.id}] ${workflow.name}`);
          if (workflow.stages) {
            console.log(`      Stages: ${workflow.stages.map((s) => s.name).join(' → ')}`);
          }
        }
        break;
      }

      case 'list-stages': {
        const workflowIdArg = cmdArgs[0];
        if (!workflowIdArg) {
          console.error('Error: workflow_id is required');
          process.exit(1);
        }
        const workflowId = parseInt(workflowIdArg);
        if (isNaN(workflowId)) {
          console.error('Error: workflow_id must be a number');
          process.exit(1);
        }
        console.log(`Listing stages for workflow ${workflowId}...`);
        const stages = await workflows.getStages(workflowId);
        console.log(`\nFound ${stages.length} stages:\n`);
        for (const stage of stages) {
          console.log(`  [${stage.id}] ${stage.name} (position: ${stage.position ?? 0})`);
        }
        break;
      }

      case 'stage-tasks': {
        const wfArg = cmdArgs[0];
        const stArg = cmdArgs[1];
        if (!wfArg || !stArg) {
          console.error('Error: workflow_id and stage_id are required');
          process.exit(1);
        }
        const workflowId = parseInt(wfArg);
        const stageId = parseInt(stArg);
        if (isNaN(workflowId) || isNaN(stageId)) {
          console.error('Error: workflow_id and stage_id must be numbers');
          process.exit(1);
        }
        console.log(`Listing tasks in stage ${stageId} of workflow ${workflowId}...`);
        const response = await workflows.getStageTasks(workflowId, stageId, {
          include: ['tags'],
        });
        console.log(`\nFound ${response.tasks.length} tasks:\n`);
        for (const task of response.tasks) {
          console.log(`  [${task.id}] ${task.name}`);
          console.log(`      Status: ${task.status}`);
        }
        break;
      }

      case 'move-task': {
        const tArg = cmdArgs[0];
        const wArg = cmdArgs[1];
        const sArg = cmdArgs[2];
        if (!tArg || !wArg || !sArg) {
          console.error('Error: task_id, workflow_id, and stage_id are required');
          process.exit(1);
        }
        const taskId = parseInt(tArg);
        const workflowId = parseInt(wArg);
        const stageId = parseInt(sArg);
        if (isNaN(taskId) || isNaN(workflowId) || isNaN(stageId)) {
          console.error('Error: task_id, workflow_id, and stage_id must be numbers');
          process.exit(1);
        }
        console.log(`Moving task ${taskId} to stage ${stageId} in workflow ${workflowId}...`);
        await workflows.moveTaskToStage(taskId, workflowId, stageId);
        console.log('Task moved successfully.');
        break;
      }

      case 'update-status': {
        const taskArg = cmdArgs[0];
        const status = cmdArgs[1];
        if (!taskArg) {
          console.error('Error: task_id is required');
          process.exit(1);
        }
        const taskId = parseInt(taskArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }
        if (!status) {
          console.error('Error: status is required');
          process.exit(1);
        }
        console.log(`Updating task ${taskId} to status "${status}"...`);
        await tasks.update(taskId, { status });
        console.log('Task status updated successfully.');
        break;
      }

      case 'eligible-tasks': {
        const projectArg = cmdArgs[0];
        if (!projectArg) {
          console.error('Error: project_id is required');
          process.exit(1);
        }
        const projectId = parseInt(projectArg);
        if (isNaN(projectId)) {
          console.error('Error: project_id must be a number');
          process.exit(1);
        }
        console.log(`Getting eligible tasks for project ${projectId}...`);
        const monitor = createTaskMonitor({ defaultProjectId: projectId });
        const eligibleTasks = await monitor.getEligibleTasks(projectId);
        console.log(`\nFound ${eligibleTasks.length} eligible tasks:\n`);
        for (const task of eligibleTasks) {
          console.log(`  [${task.task_id}] ${task.title}`);
          console.log(`      Trigger: ${task.execution_trigger}`);
          console.log(`      Tags: ${JSON.stringify(task.tags)}`);
          if (task.task_prompt) {
            console.log(`      Prompt: ${task.task_prompt.slice(0, 100)}...`);
          }
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run with --help to see available commands.');
        process.exit(1);
    }
  } catch (error) {
    console.error('\nError:', (error as Error).message);
    if ((error as any).status) {
      console.error(`HTTP Status: ${(error as any).status}`);
    }
    if ((error as any).body) {
      console.error('Response:', formatJson((error as any).body));
    }
    process.exit(1);
  }
}

main();
