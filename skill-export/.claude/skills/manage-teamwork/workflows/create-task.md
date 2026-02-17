# Workflow: Create Task

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
2. references/task-operations.md (for task options)
</required_reading>

<process>
## Step 1: Gather Required Information

**Required:**
- Tasklist ID (tasks belong to tasklists, not projects directly)
- Task name

**Optional:**
- Description
- Priority: `none`, `low`, `medium`, `high`
- Due date (YYYY-MM-DD format)
- Start date
- Estimated minutes
- Assignee user IDs
- Tag IDs
- Parent task ID (for subtasks)

If tasklist ID is unknown, first get tasklists for the project:

```typescript
const tasklists = await client.projects.getTasklists(PROJECT_ID);
console.log('Tasklists:');
for (const tl of tasklists.tasklists) {
  console.log(`- [${tl.id}] ${tl.name}`);
}
```

## Step 2: Create Task

```typescript
import { createTeamworkClient } from '/Users/dalton/projects/teamwork/apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

const task = await client.tasks.create(TASKLIST_ID, {
  name: 'Task name here',
  description: 'Task description',
  priority: 'medium',
  dueDate: '2024-12-31',
  estimatedMinutes: 120,
  assigneeUserIds: [USER_ID],  // optional
  tagIds: [TAG_ID],  // optional
});

console.log(`Created task: ${task.id} - ${task.name}`);
```

## Step 3: Create Subtask

Subtasks are tasks with a `parentTaskId`. Use the task's update method after creation:

```typescript
// First create the main task
const parentTask = await client.tasks.create(TASKLIST_ID, {
  name: 'Parent task',
});

// Then create subtask under it
const subtask = await client.tasks.create(TASKLIST_ID, {
  name: 'Subtask name',
  description: 'Subtask details',
});

// Update to set parent (API limitation - can't set on create)
await client.tasks.update(subtask.id, {
  // Note: parentTaskId may need to be set via direct API call
});
```

**Alternative: Use direct API for subtask:**
```typescript
// The tasks resource creates in tasklist, for subtasks you may need
// to use the parent task endpoint directly
const response = await client.http.post(
  `/projects/api/v3/tasks/${PARENT_TASK_ID}/subtasks.json`,
  {
    task: {
      name: 'Subtask name',
      description: 'Details',
    }
  }
);
```

## Step 4: Verify Creation

```typescript
const createdTask = await client.tasks.get(task.id, ['tags', 'assignees']);
console.log('Task details:', createdTask);
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Tasklist ID identified
- [ ] Task created with required fields
- [ ] Task ID returned and logged
- [ ] Subtask linked to parent (if applicable)
</success_criteria>
