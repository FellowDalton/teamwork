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
  'add-task-to-stage': 'Add a task to a workflow stage (first time)',
  'move-task': 'Move task to a different stage (must be on board)',
  'update-task': 'Update task name or description',
  'update-status': 'Update task status',
  'update-task-dates': 'Update task start and due dates',
  'eligible-tasks': 'Get eligible tasks for automated processing',
  'list-projects': 'List all projects',
  'list-tasklists': 'List tasklists for a project',
  'export-project': 'Export all tasklists, tasks and subtasks from a project',
  'create-project': 'Create a new project',
  'create-tasklist': 'Create a new tasklist in a project',
  'create-task': 'Create a new task in a tasklist',
  'list-users': 'List users (optionally filter by project)',
  'assign-task': 'Assign a task to a user',
  'bulk-assign': 'Assign all tasks in a project to a user',
  'move-task-to-tasklist': 'Move a task to a different tasklist',
  'rename-tasklist': 'Rename a tasklist',
  'delete-tasklist': 'Delete a tasklist',
  'get-tasklist': 'Get tasklist details including dates',
  'update-tasklist': 'Update tasklist dates',
  'log-time': 'Log time to a project',
  'log-time-task': 'Log time to a specific task',
  'complete-task': 'Mark a task as complete',
  'comment-task': 'Add a comment to a task',
  'list-comments': 'List comments on a task',
  'delete-comment': 'Delete a comment from a task',
  'delete-task': 'Delete a task permanently',
  'remove-from-board': 'Remove a task from the board (back to backlog)',
  'update-timelog': 'Update a timelog description',
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

      case 'add-task-to-stage': {
        // Usage: add-task-to-stage <task_id> <workflow_id> <stage_id>
        // Adds a task to a workflow board for the first time
        const tArg = cmdArgs[0];
        const wArg = cmdArgs[1];
        const sArg = cmdArgs[2];
        if (!tArg || !wArg || !sArg) {
          console.error('Error: task_id, workflow_id, and stage_id are required');
          console.error('Usage: add-task-to-stage <task_id> <workflow_id> <stage_id>');
          console.error('  Use this to add a task to the workflow board for the first time.');
          console.error('  Use move-task to move a task already on the board to a different stage.');
          process.exit(1);
        }
        const taskId = parseInt(tArg);
        const workflowId = parseInt(wArg);
        const stageId = parseInt(sArg);
        if (isNaN(taskId) || isNaN(workflowId) || isNaN(stageId)) {
          console.error('Error: task_id, workflow_id, and stage_id must be numbers');
          process.exit(1);
        }
        console.log(`Adding task ${taskId} to stage ${stageId} in workflow ${workflowId}...`);
        await workflows.addTaskToStage(workflowId, stageId, taskId);
        console.log('Task added to workflow board successfully.');
        break;
      }

      case 'move-task': {
        const tArg = cmdArgs[0];
        const wArg = cmdArgs[1];
        const sArg = cmdArgs[2];
        if (!tArg || !wArg || !sArg) {
          console.error('Error: task_id, workflow_id, and stage_id are required');
          console.error('Usage: move-task <task_id> <workflow_id> <stage_id>');
          console.error('  Use this to move a task already on the board to a different stage.');
          console.error('  Use add-task-to-stage to add a task to the board for the first time.');
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

      case 'update-task': {
        // Usage: update-task <task_id> [--name="New Name"] [--description="New Description"]
        const taskIdArg = cmdArgs[0];
        if (!taskIdArg) {
          console.error('Error: task_id is required');
          console.error('Usage: update-task <task_id> [--name="New Name"] [--description="New Description"]');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }

        const updates: { name?: string; description?: string } = {};
        for (let i = 1; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if (arg.startsWith('--name=')) {
            updates.name = arg.substring(7);
          } else if (arg.startsWith('--description=')) {
            updates.description = arg.substring(14);
          }
        }

        if (Object.keys(updates).length === 0) {
          console.error('Error: No updates provided');
          console.error('Usage: update-task <task_id> [--name="New Name"] [--description="New Description"]');
          process.exit(1);
        }

        console.log(`Updating task ${taskId}...`);
        if (updates.name) console.log(`  Name: ${updates.name}`);
        if (updates.description) console.log(`  Description: ${updates.description.substring(0, 50)}...`);
        await tasks.update(taskId, updates);
        console.log('Task updated successfully.');
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

      case 'update-task-dates': {
        // Usage: update-task-dates <task_id> <start_date> <due_date>
        const taskIdArg = cmdArgs[0];
        const startDate = cmdArgs[1];
        const dueDate = cmdArgs[2];
        if (!taskIdArg || !startDate || !dueDate) {
          console.error('Error: task_id, start_date, and due_date are required');
          console.error('Usage: update-task-dates <task_id> <start_date> <due_date>');
          console.error('  date format: YYYY-MM-DD');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }
        // Validate date formats
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
          console.error('Error: dates must be in YYYY-MM-DD format');
          process.exit(1);
        }
        console.log(`Updating task ${taskId} dates: ${startDate} → ${dueDate}...`);
        await tasks.update(taskId, { startDate, dueDate });
        console.log('Task dates updated successfully.');
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

      case 'list-tasklists': {
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
        console.log(`Listing tasklists for project ${projectId}...`);
        const response = await projects.getTasklists(projectId);
        console.log(`\nFound ${response.tasklists.length} tasklists:\n`);
        for (const tl of response.tasklists) {
          console.log(`  [${tl.id}] ${tl.name}`);
          if (tl.description) {
            console.log(`      ${tl.description.slice(0, 80)}...`);
          }
        }
        break;
      }

      case 'create-project': {
        const projectName = cmdArgs[0];
        if (!projectName) {
          console.error('Error: project name is required');
          console.error('Usage: create-project "Project Name" ["Description"]');
          process.exit(1);
        }
        const projectDescription = cmdArgs[1];
        console.log(`Creating project "${projectName}"...`);
        const result = await projects.create({
          name: projectName,
          description: projectDescription,
        });
        console.log(`\nProject created successfully!`);
        console.log(`  ID: ${result.id}`);
        console.log(`  Status: ${result.status}`);
        break;
      }

      case 'create-tasklist': {
        const projectIdArg = cmdArgs[0];
        const tasklistName = cmdArgs[1];
        if (!projectIdArg || !tasklistName) {
          console.error('Error: project_id and tasklist name are required');
          console.error('Usage: create-tasklist <project_id> "Tasklist Name" ["Description"]');
          process.exit(1);
        }
        const projectId = parseInt(projectIdArg);
        if (isNaN(projectId)) {
          console.error('Error: project_id must be a number');
          process.exit(1);
        }
        const tasklistDescription = cmdArgs[2];
        console.log(`Creating tasklist "${tasklistName}" in project ${projectId}...`);
        const result = await projects.createTasklist(projectId, {
          name: tasklistName,
          description: tasklistDescription,
        });
        console.log(`\nTasklist created successfully!`);
        console.log(`  ID: ${result.id}`);
        console.log(`  Status: ${result.status}`);
        break;
      }

      case 'create-task': {
        // Usage: create-task <tasklist_id> "Task Name" ["Description"] [--start=YYYY-MM-DD] [--due=YYYY-MM-DD] [--priority=low|medium|high] [--assignee=user_id]
        const tasklistIdArg = cmdArgs[0];
        const taskName = cmdArgs[1];
        if (!tasklistIdArg || !taskName) {
          console.error('Error: tasklist_id and task name are required');
          console.error('Usage: create-task <tasklist_id> "Task Name" ["Description"] [--start=YYYY-MM-DD] [--due=YYYY-MM-DD] [--priority=low|medium|high] [--assignee=user_id]');
          process.exit(1);
        }
        const tasklistId = parseInt(tasklistIdArg);
        if (isNaN(tasklistId)) {
          console.error('Error: tasklist_id must be a number');
          process.exit(1);
        }

        // Parse optional args
        let taskDescription: string | undefined;
        let startDate: string | undefined;
        let dueDate: string | undefined;
        let priority: 'none' | 'low' | 'medium' | 'high' | undefined;
        let assigneeId: number | undefined;

        for (let i = 2; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if (arg.startsWith('--start=')) {
            startDate = arg.substring(8);
          } else if (arg.startsWith('--due=')) {
            dueDate = arg.substring(6);
          } else if (arg.startsWith('--priority=')) {
            priority = arg.substring(11) as 'none' | 'low' | 'medium' | 'high';
          } else if (arg.startsWith('--assignee=')) {
            const assigneeValue = arg.substring(11);
            const parsed = parseInt(assigneeValue);
            if (!isNaN(parsed)) {
              assigneeId = parsed;
            } else {
              // Resolve name to user ID
              const searchName = assigneeValue.toLowerCase();
              const usersResponse = await client.get<{ people: Array<{ id: number; firstName: string; lastName: string }> }>(
                '/projects/api/v3/people.json?pageSize=100'
              );
              const match = usersResponse.people.find(
                (u) => `${u.firstName} ${u.lastName}`.toLowerCase() === searchName
                    || u.firstName.toLowerCase() === searchName
                    || u.lastName.toLowerCase() === searchName
              );
              if (match) {
                assigneeId = match.id;
                console.log(`  Resolved assignee "${assigneeValue}" → ${match.firstName} ${match.lastName} (${match.id})`);
              } else {
                console.error(`  Warning: Could not find user "${assigneeValue}", skipping assignment.`);
              }
            }
          } else if (!taskDescription) {
            taskDescription = arg;
          }
        }

        console.log(`Creating task "${taskName}" in tasklist ${tasklistId}...`);
        const task = await tasks.create(tasklistId, {
          name: taskName,
          description: taskDescription,
          startDate,
          dueDate,
          priority,
        });
        console.log(`\nTask created successfully!`);
        console.log(`  ID: ${task.id}`);
        console.log(`  Name: ${task.name}`);
        if (task.startDate) console.log(`  Start: ${task.startDate}`);
        if (task.dueDate) console.log(`  Due: ${task.dueDate}`);

        // Assign if --assignee was provided
        if (assigneeId && !isNaN(assigneeId)) {
          console.log(`  Assigning to user ${assigneeId}...`);
          await tasks.update(task.id, { assigneeUserIds: [assigneeId] });
          console.log(`  Assigned successfully.`);
        }
        break;
      }

      case 'list-users': {
        const projectIdArg = cmdArgs[0];
        let url = '/projects/api/v3/people.json?pageSize=100';
        if (projectIdArg) {
          const projectId = parseInt(projectIdArg);
          if (!isNaN(projectId)) {
            url = `/projects/api/v3/projects/${projectId}/people.json?pageSize=100`;
            console.log(`Listing users for project ${projectId}...`);
          }
        } else {
          console.log('Listing all users...');
        }
        const response = await client.get<{ people: Array<{ id: number; firstName: string; lastName: string; email: string }> }>(url);
        console.log(`\nFound ${response.people.length} users:\n`);
        for (const user of response.people) {
          console.log(`  [${user.id}] ${user.firstName} ${user.lastName} (${user.email})`);
        }
        break;
      }

      case 'assign-task': {
        const taskIdArg = cmdArgs[0];
        const userIdArg = cmdArgs[1];
        if (!taskIdArg || !userIdArg) {
          console.error('Error: task_id and user_id are required');
          console.error('Usage: assign-task <task_id> <user_id>');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        const userId = parseInt(userIdArg);
        if (isNaN(taskId) || isNaN(userId)) {
          console.error('Error: task_id and user_id must be numbers');
          process.exit(1);
        }
        console.log(`Assigning task ${taskId} to user ${userId}...`);
        await tasks.update(taskId, { assigneeUserIds: [userId] });
        console.log('Task assigned successfully.');
        break;
      }

      case 'bulk-assign': {
        const projectIdArg = cmdArgs[0];
        const userIdArg = cmdArgs[1];
        if (!projectIdArg || !userIdArg) {
          console.error('Error: project_id and user_id are required');
          console.error('Usage: bulk-assign <project_id> <user_id>');
          process.exit(1);
        }
        const projectId = parseInt(projectIdArg);
        const userId = parseInt(userIdArg);
        if (isNaN(projectId) || isNaN(userId)) {
          console.error('Error: project_id and user_id must be numbers');
          process.exit(1);
        }
        console.log(`Fetching all tasks for project ${projectId}...`);

        // Get all tasks (may need pagination for large projects)
        let allTasks: Array<{ id: number; name: string }> = [];
        let page = 1;
        while (true) {
          const response = await tasks.listByProject(projectId, { pageSize: 250, page });
          allTasks = allTasks.concat(response.tasks);
          if (response.tasks.length < 250) break;
          page++;
        }

        console.log(`Found ${allTasks.length} tasks. Assigning to user ${userId}...`);
        let success = 0;
        let failed = 0;
        for (const task of allTasks) {
          try {
            await tasks.update(task.id, { assigneeUserIds: [userId] });
            success++;
            process.stdout.write(`\r  Assigned ${success}/${allTasks.length} tasks...`);
          } catch (error) {
            failed++;
            console.error(`\n  Failed to assign task ${task.id}: ${(error as Error).message}`);
          }
        }
        console.log(`\n\nDone! Assigned ${success} tasks, ${failed} failed.`);
        break;
      }

      case 'move-task-to-tasklist': {
        const taskIdArg = cmdArgs[0];
        const tasklistIdArg = cmdArgs[1];
        if (!taskIdArg || !tasklistIdArg) {
          console.error('Error: task_id and tasklist_id are required');
          console.error('Usage: move-task-to-tasklist <task_id> <tasklist_id>');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        const tasklistId = parseInt(tasklistIdArg);
        if (isNaN(taskId) || isNaN(tasklistId)) {
          console.error('Error: task_id and tasklist_id must be numbers');
          process.exit(1);
        }
        console.log(`Moving task ${taskId} to tasklist ${tasklistId}...`);
        await client.patch(`/projects/api/v3/tasks/${taskId}.json`, {
          task: { tasklistId }
        });
        console.log('Task moved successfully.');
        break;
      }

      case 'rename-tasklist': {
        const tasklistIdArg = cmdArgs[0];
        const newName = cmdArgs[1];
        if (!tasklistIdArg || !newName) {
          console.error('Error: tasklist_id and new_name are required');
          console.error('Usage: rename-tasklist <tasklist_id> "New Name"');
          process.exit(1);
        }
        const tasklistId = parseInt(tasklistIdArg);
        if (isNaN(tasklistId)) {
          console.error('Error: tasklist_id must be a number');
          process.exit(1);
        }
        console.log(`Renaming tasklist ${tasklistId} to "${newName}"...`);
        await client.put(`/tasklists/${tasklistId}.json`, {
          'todo-list': { name: newName }
        });
        console.log('Tasklist renamed successfully.');
        break;
      }

      case 'delete-tasklist': {
        const tasklistIdArg = cmdArgs[0];
        if (!tasklistIdArg) {
          console.error('Error: tasklist_id is required');
          console.error('Usage: delete-tasklist <tasklist_id>');
          process.exit(1);
        }
        const tasklistId = parseInt(tasklistIdArg);
        if (isNaN(tasklistId)) {
          console.error('Error: tasklist_id must be a number');
          process.exit(1);
        }
        console.log(`Deleting tasklist ${tasklistId}...`);
        await client.delete(`/tasklists/${tasklistId}.json`);
        console.log('Tasklist deleted successfully.');
        break;
      }

      case 'get-tasklist': {
        const tasklistIdArg = cmdArgs[0];
        if (!tasklistIdArg) {
          console.error('Error: tasklist_id is required');
          console.error('Usage: get-tasklist <tasklist_id>');
          process.exit(1);
        }
        const tasklistId = parseInt(tasklistIdArg);
        if (isNaN(tasklistId)) {
          console.error('Error: tasklist_id must be a number');
          process.exit(1);
        }
        console.log(`Getting tasklist ${tasklistId}...`);
        const response = await client.get<{ 'todo-list': any }>(`/tasklists/${tasklistId}.json`);
        const tl = response['todo-list'];
        console.log(`\nTasklist: ${tl.name}`);
        console.log(`  ID: ${tl.id}`);
        console.log(`  Description: ${tl.description || '(none)'}`);
        console.log(`  Start Date: ${tl.startDate || '(not set)'}`);
        console.log(`  Due Date: ${tl.dueDate || '(not set)'}`);
        console.log(`  Status: ${tl.status || '(unknown)'}`);
        break;
      }

      case 'update-tasklist': {
        // Usage: update-tasklist <tasklist_id> [--start=YYYY-MM-DD] [--due=YYYY-MM-DD] [--name="New Name"] [--description="New Desc"]
        const tasklistIdArg = cmdArgs[0];
        if (!tasklistIdArg) {
          console.error('Error: tasklist_id is required');
          console.error('Usage: update-tasklist <tasklist_id> [--start=YYYY-MM-DD] [--due=YYYY-MM-DD] [--name="Name"] [--description="Desc"]');
          process.exit(1);
        }
        const tasklistId = parseInt(tasklistIdArg);
        if (isNaN(tasklistId)) {
          console.error('Error: tasklist_id must be a number');
          process.exit(1);
        }

        const updates: any = {};
        for (let i = 1; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if (arg.startsWith('--start=')) {
            updates.startDate = arg.substring(8);
          } else if (arg.startsWith('--due=')) {
            updates.dueDate = arg.substring(6);
          } else if (arg.startsWith('--name=')) {
            updates.name = arg.substring(7);
          } else if (arg.startsWith('--description=')) {
            updates.description = arg.substring(14);
          }
        }

        if (Object.keys(updates).length === 0) {
          console.error('Error: No updates provided');
          console.error('Usage: update-tasklist <tasklist_id> [--start=YYYY-MM-DD] [--due=YYYY-MM-DD] [--name="Name"] [--description="Desc"]');
          process.exit(1);
        }

        console.log(`Updating tasklist ${tasklistId}...`);
        console.log(`  Updates: ${JSON.stringify(updates)}`);
        await client.put(`/tasklists/${tasklistId}.json`, { 'todo-list': updates });
        console.log('Tasklist updated successfully.');
        break;
      }

      case 'log-time': {
        // Usage: log-time <project_id> <date> <hours> <minutes> "Description"
        const projectIdArg = cmdArgs[0];
        const dateArg = cmdArgs[1];
        const hoursArg = cmdArgs[2];
        const minutesArg = cmdArgs[3];
        const description = cmdArgs[4];

        if (!projectIdArg || !dateArg || !hoursArg) {
          console.error('Error: project_id, date, and hours are required');
          console.error('Usage: log-time <project_id> <date> <hours> [minutes] ["Description"]');
          console.error('  date format: YYYY-MM-DD');
          console.error('Example: log-time 804926 2026-01-22 8 0 "Backend work"');
          process.exit(1);
        }

        const projectId = parseInt(projectIdArg);
        const hours = parseInt(hoursArg);
        const minutes = minutesArg ? parseInt(minutesArg) : 0;

        if (isNaN(projectId) || isNaN(hours) || isNaN(minutes)) {
          console.error('Error: project_id, hours, and minutes must be numbers');
          process.exit(1);
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
          console.error('Error: date must be in YYYY-MM-DD format');
          process.exit(1);
        }

        console.log(`Logging ${hours}h ${minutes}m to project ${projectId} on ${dateArg}...`);

        const timelogPayload = {
          timelog: {
            date: dateArg,
            time: '09:00:00',
            hours,
            minutes,
            description: description || '',
            isBillable: false,
          },
        };

        const response = await client.post<{ timelog: { id: number } }>(
          `/projects/api/v3/projects/${projectId}/time.json`,
          timelogPayload
        );

        console.log(`Time logged successfully! Timelog ID: ${response.timelog.id}`);
        break;
      }

      case 'log-time-task': {
        // Usage: log-time-task <task_id> <date> <hours> <minutes> "Description" [--billable]
        const taskIdArg = cmdArgs[0];
        const dateArg = cmdArgs[1];
        const hoursArg = cmdArgs[2];
        const minutesArg = cmdArgs[3];

        if (!taskIdArg || !dateArg || !hoursArg) {
          console.error('Error: task_id, date, and hours are required');
          console.error('Usage: log-time-task <task_id> <date> <hours> [minutes] ["Description"] [--billable]');
          console.error('  date format: YYYY-MM-DD');
          console.error('Example: log-time-task 26799141 2025-01-26 3 0 "Jeg har samlet dokumentation" --billable');
          process.exit(1);
        }

        const taskId = parseInt(taskIdArg);
        const hours = parseInt(hoursArg);
        const minutes = minutesArg && !minutesArg.startsWith('--') ? parseInt(minutesArg) : 0;

        if (isNaN(taskId) || isNaN(hours) || isNaN(minutes)) {
          console.error('Error: task_id, hours, and minutes must be numbers');
          process.exit(1);
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
          console.error('Error: date must be in YYYY-MM-DD format');
          process.exit(1);
        }

        // Parse description and billable flag (start after minutes arg if present)
        let description = '';
        let isBillable = false;
        const descStartIdx = (minutesArg && !minutesArg.startsWith('--')) ? 4 : 3;
        for (let i = descStartIdx; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if (arg === '--billable') {
            isBillable = true;
          } else if (!arg.startsWith('--') && !description) {
            description = arg;
          }
        }

        console.log(`Logging ${hours}h ${minutes}m to task ${taskId} on ${dateArg}${isBillable ? ' (billable)' : ''}...`);

        const timelogPayload = {
          timelog: {
            date: dateArg,
            time: '09:00:00',
            hours,
            minutes,
            description: description || '',
            isBillable,
          },
        };

        const response = await client.post<{ timelog: { id: number } }>(
          `/projects/api/v3/tasks/${taskId}/time.json`,
          timelogPayload
        );

        console.log(`Time logged successfully! Timelog ID: ${response.timelog.id}`);
        break;
      }

      case 'complete-task': {
        // Usage: complete-task <task_id>
        const taskIdArg = cmdArgs[0];
        if (!taskIdArg) {
          console.error('Error: task_id is required');
          console.error('Usage: complete-task <task_id>');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }
        console.log(`Marking task ${taskId} as complete...`);
        await client.put(`/tasks/${taskId}/complete.json`, {});
        console.log('Task completed successfully.');
        break;
      }

      case 'comment-task': {
        // Usage: comment-task <task_id> "Comment text"
        const taskIdArg = cmdArgs[0];
        const commentBody = cmdArgs[1];
        if (!taskIdArg || !commentBody) {
          console.error('Error: task_id and comment text are required');
          console.error('Usage: comment-task <task_id> "Comment text"');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }
        console.log(`Adding comment to task ${taskId}...`);
        const response = await client.post<{ comment?: { id: number }; commentId?: number; id?: number }>(
          `/tasks/${taskId}/comments.json`,
          { comment: { body: commentBody, 'content-type': 'text', 'notify': '' } }
        );
        // Handle different response formats from V1 API
        const commentId = response.comment?.id ?? response.commentId ?? response.id ?? 'created';
        console.log(`Comment added successfully! Comment ID: ${commentId}`);
        break;
      }

      case 'list-comments': {
        // Usage: list-comments <task_id>
        const taskIdArg = cmdArgs[0];
        if (!taskIdArg) {
          console.error('Error: task_id is required');
          console.error('Usage: list-comments <task_id>');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }
        console.log(`Listing comments for task ${taskId}...`);
        const response = await client.get<{ comments: Array<{ id: number; body: string; authorId?: number; createdAt?: string }> }>(
          `/tasks/${taskId}/comments.json`
        );
        const comments = response.comments || [];
        console.log(`\nFound ${comments.length} comments:\n`);
        for (const c of comments) {
          const preview = (c.body || '').replace(/<[^>]*>/g, '').substring(0, 120);
          console.log(`  [${c.id}] ${preview}`);
        }
        break;
      }

      case 'delete-comment': {
        // Usage: delete-comment <comment_id>
        const commentIdArg = cmdArgs[0];
        if (!commentIdArg) {
          console.error('Error: comment_id is required');
          console.error('Usage: delete-comment <comment_id>');
          process.exit(1);
        }
        const commentId = parseInt(commentIdArg);
        if (isNaN(commentId)) {
          console.error('Error: comment_id must be a number');
          process.exit(1);
        }
        console.log(`Deleting comment ${commentId}...`);
        await client.delete(`/comments/${commentId}.json`);
        console.log(`Comment ${commentId} deleted successfully!`);
        break;
      }

      case 'remove-from-board': {
        // Usage: remove-from-board <workflow_id> <stage_id> <task_id>
        const wfArg = cmdArgs[0];
        const stArg = cmdArgs[1];
        const taskIdArg = cmdArgs[2];
        if (!wfArg || !stArg || !taskIdArg) {
          console.error('Error: workflow_id, stage_id, and task_id are required');
          console.error('Usage: remove-from-board <workflow_id> <stage_id> <task_id>');
          process.exit(1);
        }
        const workflowId = parseInt(wfArg);
        const stageId = parseInt(stArg);
        const taskId = parseInt(taskIdArg);
        if (isNaN(workflowId) || isNaN(stageId) || isNaN(taskId)) {
          console.error('Error: all IDs must be numbers');
          process.exit(1);
        }
        console.log(`Removing task ${taskId} from stage ${stageId} (workflow ${workflowId})...`);
        // NOTE: Teamwork API does not support moving tasks to backlog.
        // PATCH /tasks/{id}/workflows/{id} with stageId: 0/null causes 500.
        // This command just moves to the target stage instead.
        console.log(`Moving task ${taskId} to stage ${stageId}...`);
        await workflows.moveTaskToStage(taskId, workflowId, stageId);
        console.log(`Task ${taskId} moved to stage ${stageId}.`);
        break;
      }

      case 'update-timelog': {
        // Usage: update-timelog <timelog_id> "New Description"
        const timelogIdArg = cmdArgs[0];
        const newDescription = cmdArgs[1];

        if (!timelogIdArg || !newDescription) {
          console.error('Error: timelog_id and description are required');
          console.error('Usage: update-timelog <timelog_id> "New Description"');
          process.exit(1);
        }

        const timelogId = parseInt(timelogIdArg);
        if (isNaN(timelogId)) {
          console.error('Error: timelog_id must be a number');
          process.exit(1);
        }

        console.log(`Updating timelog ${timelogId}...`);

        await client.patch(`/projects/api/v3/time/${timelogId}.json`, {
          timelog: {
            description: newDescription,
          },
        });

        console.log(`Timelog ${timelogId} updated successfully!`);
        break;
      }

      case 'export-project': {
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

        console.log(`Exporting project ${projectId}...`);

        // Get project details
        const project = await projects.get(projectId);
        console.log(`Project: ${project.name}`);

        // Get all tasklists
        const tasklistsResponse = await projects.getTasklists(projectId);
        console.log(`Found ${tasklistsResponse.tasklists.length} tasklists`);

        interface TaskData {
          id: number;
          name: string;
          description?: string;
          status: string;
          priority?: string;
          startDate?: string | null;
          dueDate?: string | null;
          subtasks: TaskData[];
        }

        interface TasklistData {
          id: number;
          name: string;
          description?: string;
          tasks: TaskData[];
        }

        const output: {
          project: { id: number; name: string };
          tasklists: TasklistData[];
          exportDate: string;
        } = {
          project: { id: project.id, name: project.name },
          tasklists: [],
          exportDate: new Date().toISOString(),
        };

        // Get tasks for each tasklist
        for (const tasklist of tasklistsResponse.tasklists) {
          console.log(`  Fetching tasklist: ${tasklist.name}...`);

          const tasklistData: TasklistData = {
            id: tasklist.id,
            name: tasklist.name,
            description: tasklist.description,
            tasks: [],
          };

          // Get tasks for this tasklist - include completed
          const tasksResponse = await tasks.listByTasklist(tasklist.id, {
            includeCompletedTasks: true,
            pageSize: 250,
          });

          // Build a map of parent tasks
          const parentTasks = new Map<number, TaskData>();
          const subtasksByParent = new Map<number, TaskData[]>();

          for (const task of tasksResponse.tasks) {
            const taskData: TaskData = {
              id: task.id,
              name: task.name,
              description: task.description,
              status: task.status,
              priority: task.priority,
              startDate: task.startDate,
              dueDate: task.dueDate,
              subtasks: [],
            };

            if (task.parentTaskId) {
              // This is a subtask
              if (!subtasksByParent.has(task.parentTaskId)) {
                subtasksByParent.set(task.parentTaskId, []);
              }
              subtasksByParent.get(task.parentTaskId)!.push(taskData);
            } else {
              // This is a parent task
              parentTasks.set(task.id, taskData);
            }
          }

          // Attach subtasks to parent tasks
          for (const [parentId, subtasks] of subtasksByParent) {
            const parent = parentTasks.get(parentId);
            if (parent) {
              parent.subtasks = subtasks;
            }
          }

          // Add parent tasks to tasklist
          tasklistData.tasks = Array.from(parentTasks.values());
          output.tasklists.push(tasklistData);

          console.log(`    Found ${tasklistData.tasks.length} tasks`);
        }

        // Helper to format date
        const formatDate = (dateStr: string | null | undefined): string => {
          if (!dateStr) return '—';
          const date = new Date(dateStr);
          return date.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' });
        };

        // Generate markdown output
        let markdown = `# Teamwork Project: ${output.project.name}\n\n`;
        markdown += `**Project ID:** ${output.project.id}  \n`;
        markdown += `**Exported:** ${formatDate(output.exportDate)}\n\n`;
        markdown += `---\n\n`;

        // Legend
        markdown += `## Legend\n\n`;
        markdown += `| Icon | Status |\n`;
        markdown += `|------|--------|\n`;
        markdown += `| ⬜ | New/Pending |\n`;
        markdown += `| 🔄 | In Progress |\n`;
        markdown += `| ✅ | Completed |\n\n`;
        markdown += `---\n\n`;

        for (const tasklist of output.tasklists) {
          markdown += `## 📁 TASKLIST: ${tasklist.name}\n\n`;
          if (tasklist.description) {
            markdown += `> ${tasklist.description}\n\n`;
          }

          if (tasklist.tasks.length === 0) {
            markdown += `*No tasks in this tasklist*\n\n`;
            markdown += `---\n\n`;
            continue;
          }

          // Task table header
          markdown += `| Status | Task | Priority | Due Date |\n`;
          markdown += `|--------|------|----------|----------|\n`;

          for (const task of tasklist.tasks) {
            const statusIcon = task.status === 'completed' ? '✅' : task.status === 'active' ? '🔄' : '⬜';
            const priority = task.priority || '—';
            const dueDate = formatDate(task.dueDate);
            markdown += `| ${statusIcon} | **${task.name}** | ${priority} | ${dueDate} |\n`;
          }

          markdown += `\n`;

          // Task details with subtasks
          for (const task of tasklist.tasks) {
            const statusIcon = task.status === 'completed' ? '✅' : task.status === 'active' ? '🔄' : '⬜';
            markdown += `### ${statusIcon} ${task.name}\n\n`;

            // Metadata line
            const metaParts: string[] = [];
            metaParts.push(`**Status:** ${task.status}`);
            if (task.priority) metaParts.push(`**Priority:** ${task.priority}`);
            if (task.startDate) metaParts.push(`**Start:** ${formatDate(task.startDate)}`);
            if (task.dueDate) metaParts.push(`**Due:** ${formatDate(task.dueDate)}`);
            markdown += metaParts.join(' | ') + '\n';

            if (task.description) {
              markdown += `\n${task.description}\n`;
            }

            if (task.subtasks && task.subtasks.length > 0) {
              markdown += `\n#### Subtasks (${task.subtasks.length})\n\n`;
              markdown += `| Status | Subtask | Priority | Due Date |\n`;
              markdown += `|--------|---------|----------|----------|\n`;
              for (const subtask of task.subtasks) {
                const subIcon = subtask.status === 'completed' ? '✅' : subtask.status === 'active' ? '🔄' : '⬜';
                const subPriority = subtask.priority || '—';
                const subDue = formatDate(subtask.dueDate);
                markdown += `| ${subIcon} | ${subtask.name} | ${subPriority} | ${subDue} |\n`;
              }
            }
            markdown += `\n---\n\n`;
          }
        }

        // Output to stdout (can be piped to file)
        console.log('\n--- MARKDOWN OUTPUT ---\n');
        console.log(markdown);

        // Summary stats
        const totalTasks = output.tasklists.reduce((sum, tl) => sum + tl.tasks.length, 0);
        const totalSubtasks = output.tasklists.reduce((sum, tl) =>
          sum + tl.tasks.reduce((tsum, t) => tsum + (t.subtasks?.length || 0), 0), 0);
        console.log('\n--- SUMMARY ---');
        console.log(`Tasklists: ${output.tasklists.length}`);
        console.log(`Tasks: ${totalTasks}`);
        console.log(`Subtasks: ${totalSubtasks}`);
        break;
      }

      case 'delete-task': {
        // Usage: delete-task <task_id>
        const taskIdArg = cmdArgs[0];
        if (!taskIdArg) {
          console.error('Error: task_id is required');
          console.error('Usage: delete-task <task_id>');
          process.exit(1);
        }
        const taskId = parseInt(taskIdArg);
        if (isNaN(taskId)) {
          console.error('Error: task_id must be a number');
          process.exit(1);
        }
        console.log(`Deleting task ${taskId}...`);
        await tasks.delete(taskId);
        console.log('Task deleted successfully.');
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
