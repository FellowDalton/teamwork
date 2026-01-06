---
name: manage-teamwork
description: Manage Teamwork.com projects, tasks, and workflows using the TypeScript API client. Use when creating projects, tasks, subtasks, comments, logging time, moving tasks between board stages, or querying tasks.
---

<essential_principles>
## How This Skill Works

This skill uses the Teamwork API client at `apps/teamwork_api_client/` to interact with Teamwork.com. All operations use TypeScript with Bun runtime.

### 1. Client Initialization

Always import from the client index and create a client instance:

```typescript
import { createTeamworkClient, createTaskMonitor } from './apps/teamwork_api_client/src/index.ts';

// Low-level client for direct API access
const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// High-level facade for task operations
const monitor = createTaskMonitor();
```

### 2. Environment Variables Required

```bash
TEAMWORK_API_URL=https://yoursite.teamwork.com
TEAMWORK_BEARER_TOKEN=your-api-token
TEAMWORK_PROJECT_ID=123456  # optional default
```

### 3. Error Handling Pattern

All API calls should be wrapped in try-catch:

```typescript
try {
  const result = await client.tasks.create(tasklistId, { name: 'Task' });
  console.log('Created:', result.id);
} catch (error) {
  if (error instanceof Error) {
    console.error('Failed:', error.message);
  }
  throw error;
}
```

### 4. Resource Hierarchy

```
Project
  └── Tasklist (container for tasks)
        └── Task
              ├── Subtask (task with parentTaskId)
              └── Comment
```

Tasks belong to tasklists, not directly to projects. To create a task, you need a tasklist ID.
</essential_principles>

<intake>
What would you like to do with Teamwork?

1. **Get tasks** - Query tasks for a project or tasklist
2. **Create task** - Create a new task or subtask
3. **Create tasklist** - Create a new tasklist in a project
4. **Move task** - Move a task between board stages
5. **Comment on task** - Add a comment to a task
6. **Log time** - Log time on a task
7. **Manage projects** - List, create, or get project details

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Next Action |
|----------|-------------|
| 1, "get", "query", "list", "fetch" | `workflows/get-tasks.md` |
| 2, "create task", "new task", "subtask" | `workflows/create-task.md` |
| 3, "tasklist", "task list" | `workflows/create-tasklist.md` |
| 4, "move", "stage", "board", "kanban" | `workflows/move-task.md` |
| 5, "comment" | `workflows/comment-on-task.md` |
| 6, "time", "log", "track" | `workflows/log-time.md` |
| 7, "project" | `workflows/manage-projects.md` |
| 8, "activity", "status", "report" | `workflows/get-activity-status.md` |

**After reading the workflow, follow it exactly.**
</routing>

<reference_index>
All domain knowledge in `references/`:

**API Client:** api-client.md (client setup, resources, response types)
**Task Operations:** task-operations.md (CRUD, filtering, status updates)
**Workflow/Board:** workflow-operations.md (stages, moving tasks)
</reference_index>

<workflows_index>
| Workflow | Purpose |
|----------|---------|
| get-tasks.md | Query and filter tasks by project, status, or tasklist |
| create-task.md | Create tasks and subtasks with assignments |
| create-tasklist.md | Create tasklists within projects |
| move-task.md | Move tasks between workflow/board stages |
| comment-on-task.md | Add comments to tasks |
| log-time.md | Log time entries on tasks |
| manage-projects.md | List, get, or create projects |
| get-activity-status.md | Report on work activity and status |
</workflows_index>

<quick_reference>
## Common Operations

**Get tasks for a project:**
```typescript
const tasks = await client.tasks.listByProject(projectId, {
  statuses: ['new', 'active'],
  include: ['tags', 'assignees']
});
```

**Create a task:**
```typescript
const task = await client.tasks.create(tasklistId, {
  name: 'Task name',
  description: 'Details here',
  priority: 'high',
  dueDate: '2024-12-31',
});
```

**Move task to board stage:**
```typescript
await client.workflows.moveTaskToStage(taskId, workflowId, stageId);
```

**Add comment:**
```typescript
await client.comments.postMarkdown(taskId, '**Update:** Work completed.');
```
</quick_reference>

<success_criteria>
Skill workflow is complete when:
- [ ] Correct API method identified for the operation
- [ ] Required IDs gathered (project, tasklist, task, workflow, stage)
- [ ] TypeScript code executed successfully
- [ ] Result confirmed in Teamwork or via API response
</success_criteria>
