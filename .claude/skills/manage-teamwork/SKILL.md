---
name: manage-teamwork
description: Manage Teamwork.com projects, tasks, and workflows using the CLI tool. Use when creating projects, tasks, subtasks, comments, logging time, moving tasks between board stages, or querying tasks.
---

<essential_principles>
## How This Skill Works

This skill uses the Teamwork CLI at `/Users/dalton/projects/teamwork/apps/teamwork_backend/teamwork_api_client/cli.ts`.

**From any project on this machine**, run commands like:

```bash
cd /Users/dalton/projects/teamwork && bun apps/teamwork_backend/teamwork_api_client/cli.ts <command> [args]
```

The `cd` is required so Bun loads the `.env` file with the API credentials.
</essential_principles>

<available_commands>
## Available Commands

| Command | Description |
|---------|-------------|
| `list-projects [status]` | List projects (status: active, archived, all) |
| `list-tasks <project_id> [status]` | List tasks (status: new, active, completed) |
| `get-task <task_id>` | Get a specific task by ID |
| `list-workflows` | List all workflows |
| `list-stages <workflow_id>` | List stages for a workflow |
| `stage-tasks <workflow_id> <stage_id>` | List tasks in a stage |
| `move-task <task_id> <workflow_id> <stage_id>` | Move task to stage |
| `update-status <task_id> <status>` | Update task status |
| `eligible-tasks <project_id>` | Get tasks eligible for automated processing |
| `help` | Show help message |

## Examples

```bash
# List all active projects
cd /Users/dalton/projects/teamwork && bun apps/teamwork_backend/teamwork_api_client/cli.ts list-projects

# List tasks for a project
cd /Users/dalton/projects/teamwork && bun apps/teamwork_backend/teamwork_api_client/cli.ts list-tasks 806515

# Get task details
cd /Users/dalton/projects/teamwork && bun apps/teamwork_backend/teamwork_api_client/cli.ts get-task 26781919

# Move task to a stage
cd /Users/dalton/projects/teamwork && bun apps/teamwork_backend/teamwork_api_client/cli.ts move-task 26781919 12345 67890
```
</available_commands>

<adding_commands>
## Adding New Commands

If a command you need doesn't exist, add it to the CLI:

**File:** `/Users/dalton/projects/teamwork/apps/teamwork_backend/teamwork_api_client/cli.ts`

### Step 1: Add to COMMANDS object

```typescript
const COMMANDS = {
  // ... existing commands ...
  'your-command': 'Description of your command',
};
```

### Step 2: Add case in the switch statement

```typescript
case 'your-command': {
  const arg1 = cmdArgs[0];
  if (!arg1) {
    console.error('Error: arg1 is required');
    process.exit(1);
  }

  // Use existing resources:
  // - tasks (TasksResource)
  // - workflows (WorkflowsResource)
  // - projects (ProjectsResource)

  // Or use client.http for direct API calls:
  const response = await client.http.get('/projects/api/v3/some-endpoint.json');
  console.log(formatJson(response));
  break;
}
```

### Available Resources

The CLI has access to:

| Resource | Methods |
|----------|---------|
| `tasks` | `list()`, `listByProject()`, `listByTasklist()`, `get()`, `create()`, `update()`, `complete()`, `delete()` |
| `workflows` | `list()`, `getStages()`, `moveTaskToStage()`, `getStageTasks()`, `getBacklogTasks()` |
| `projects` | `list()`, `get()`, `getTasklists()`, `getActiveWorkflow()`, `searchByName()`, `create()`, `createTasklist()` |
| `client.http` | `get()`, `post()`, `patch()`, `delete()` - for direct API calls |

### Example: Add "list-tasklists" command

```typescript
// In COMMANDS object:
'list-tasklists': 'List tasklists for a project',

// In switch statement:
case 'list-tasklists': {
  const projectIdArg = cmdArgs[0];
  if (!projectIdArg) {
    console.error('Error: project_id is required');
    process.exit(1);
  }
  const projectId = parseInt(projectIdArg);
  console.log(`Listing tasklists for project ${projectId}...`);
  const response = await projects.getTasklists(projectId);
  console.log(`\nFound ${response.tasklists.length} tasklists:\n`);
  for (const tl of response.tasklists) {
    console.log(`  [${tl.id}] ${tl.name}`);
  }
  break;
}
```

### API Authentication

The API uses Basic Auth with format `token:X`. The client handles this automatically.
If you need raw fetch, use:

```typescript
const response = await fetch(url, {
  headers: {
    'Authorization': `Basic ${Buffer.from(`${token}:X`).toString('base64')}`,
    'Content-Type': 'application/json',
  },
});
```
</adding_commands>

<resource_hierarchy>
## Teamwork Resource Hierarchy

```
Project
  └── Tasklist (container for tasks)
        └── Task
              ├── Subtask (task with parentTaskId)
              └── Comment
  └── Workflow (board)
        └── Stage (column)
```

Tasks belong to tasklists, not directly to projects.
</resource_hierarchy>

<success_criteria>
Skill workflow is complete when:
- [ ] Correct CLI command identified
- [ ] Command executed successfully
- [ ] Output confirms the operation
</success_criteria>
