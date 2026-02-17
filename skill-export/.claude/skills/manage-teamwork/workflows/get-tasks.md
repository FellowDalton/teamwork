# Workflow: Get Tasks

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
2. references/task-operations.md (for filtering options)
</required_reading>

<process>
## Step 1: Determine Query Scope

Ask the user (if not already specified):
- **By project?** Need project ID
- **By tasklist?** Need tasklist ID
- **By status?** Options: `new`, `active`, `completed`, `pending`
- **Include completed?** Default is false

## Step 2: Write Query Code

```typescript
import { createTeamworkClient } from '/Users/dalton/projects/teamwork/apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// By project
const response = await client.tasks.listByProject(PROJECT_ID, {
  statuses: ['new', 'active'],  // adjust as needed
  include: ['tags', 'assignees'],
  pageSize: 50,
});

console.log(`Found ${response.tasks.length} tasks`);
for (const task of response.tasks) {
  console.log(`- [${task.id}] ${task.name} (${task.status})`);
}
```

## Step 3: Filter Variations

**By tasklist:**
```typescript
const response = await client.tasks.listByTasklist(TASKLIST_ID, {
  statuses: ['new', 'active'],
});
```

**By assignee:**
```typescript
const response = await client.tasks.listByProject(PROJECT_ID, {
  assigneeUserIds: [USER_ID],
});
```

**Include completed tasks:**
```typescript
const response = await client.tasks.listByProject(PROJECT_ID, {
  includeCompletedTasks: true,
});
```

**Search by name:**
```typescript
const response = await client.tasks.listByProject(PROJECT_ID, {
  searchTerm: 'search query',
});
```

## Step 4: Get Single Task Details

```typescript
const task = await client.tasks.get(TASK_ID, ['tags', 'assignees']);
console.log(task);
```

## Step 5: Using High-Level Monitor

For ADW-style eligible task queries:

```typescript
import { createTaskMonitor } from '/Users/dalton/projects/teamwork/apps/teamwork_api_client/src/index.ts';

const monitor = createTaskMonitor();

// Get tasks with 'execute' or 'continue' triggers
const eligibleTasks = await monitor.getEligibleTasks(
  PROJECT_ID,
  ['new', 'pending'],
  10  // limit
);
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Query scope determined (project, tasklist, or all)
- [ ] Filters applied (status, assignee, search)
- [ ] Code executed and tasks returned
- [ ] Results displayed to user
</success_criteria>
