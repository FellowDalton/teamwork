<task_listing>
## Listing Tasks

**By project:**
```typescript
const response = await client.tasks.listByProject(projectId, {
  statuses: ['new', 'active', 'pending'],
  include: ['tags', 'assignees'],
  pageSize: 50,
  page: 1,
});
```

**By tasklist:**
```typescript
const response = await client.tasks.listByTasklist(tasklistId, {
  statuses: ['new'],
});
```

**All tasks (across projects):**
```typescript
const response = await client.tasks.list({
  statuses: ['new'],
  assigneeUserIds: [userId],
});
```
</task_listing>

<list_options>
## List Options

| Option | Type | Description |
|--------|------|-------------|
| `statuses` | `string[]` | Filter by: `new`, `active`, `completed`, `pending` |
| `tagIds` | `number[]` | Filter by tag IDs |
| `assigneeUserIds` | `number[]` | Filter by assigned user IDs |
| `assigneeTeamIds` | `number[]` | Filter by assigned team IDs |
| `include` | `string[]` | Include: `tags`, `assignees`, `users`, `teams` |
| `page` | `number` | Page number (1-based) |
| `pageSize` | `number` | Items per page (default: 50) |
| `orderBy` | `string` | Sort field |
| `orderMode` | `'asc' \| 'desc'` | Sort direction |
| `updatedAfter` | `string` | ISO date string |
| `includeCompletedTasks` | `boolean` | Include completed (default: false) |
| `searchTerm` | `string` | Search in task name |
</list_options>

<task_status>
## Task Statuses

| Status | Description |
|--------|-------------|
| `new` | Not started |
| `active` | In progress |
| `completed` | Done |
| `pending` | Blocked/waiting |
| `reopened` | Reopened after completion |
</task_status>

<task_creation>
## Creating Tasks

Tasks belong to tasklists, not projects directly.

```typescript
const task = await client.tasks.create(tasklistId, {
  name: 'Task name',           // required
  description: 'Details',      // optional, supports markdown
  priority: 'high',            // none, low, medium, high
  dueDate: '2024-12-31',       // YYYY-MM-DD
  startDate: '2024-12-01',     // YYYY-MM-DD
  estimatedMinutes: 120,       // time estimate
  assigneeUserIds: [1, 2],     // user IDs
  assigneeTeamIds: [3],        // team IDs
  tagIds: [10, 20],            // tag IDs
});
```
</task_creation>

<task_updates>
## Updating Tasks

```typescript
await client.tasks.update(taskId, {
  name: 'New name',
  description: 'Updated description',
  status: 'active',
  priority: 'high',
  progress: 50,                 // 0-100
  dueDate: '2024-12-31',
  startDate: '2024-12-01',
  estimatedMinutes: 180,
  assigneeUserIds: [1],
  tagIds: [10],
});
```

**Quick status changes:**
```typescript
// Complete a task
await client.tasks.complete(taskId);

// Reopen a completed task
await client.tasks.reopen(taskId);

// Delete a task
await client.tasks.delete(taskId);
```
</task_updates>

<task_processing>
## Processing Tasks (ADW Integration)

The task monitor provides high-level operations:

```typescript
import { createTaskMonitor } from './apps/teamwork_api_client/src/index.ts';

const monitor = createTaskMonitor();

// Get tasks eligible for processing (have 'execute' or 'continue' trigger)
const tasks = await monitor.getEligibleTasks(projectId, ['new'], 10);

// Claim a task (sets "In Progress" + posts comment)
await monitor.claimTask(taskId, adwId, {
  model: 'sonnet',
  worktreeName: 'feat-auth',
});

// Complete a task (sets "Completed" + posts comment)
await monitor.completeTask(taskId, adwId, {
  commitHash: 'abc123',
  message: 'Completed successfully',
});

// Mark task as failed (sets "Pending" + posts error comment)
await monitor.failTask(taskId, adwId, 'Error: Something went wrong');
```
</task_processing>

<tag_parsing>
## Tag Parsing Utilities

```typescript
import {
  extractInlineTags,
  parseNativeTags,
  detectExecutionTrigger,
  cleanTaskDescription,
} from './apps/teamwork_api_client/src/index.ts';

// Extract {{key: value}} tags from description
const inlineTags = extractInlineTags('Build {{model: opus}} {{prototype: vue}}');
// → { model: 'opus', prototype: 'vue' }

// Parse native Teamwork tags (key:value format)
const nativeTags = parseNativeTags([{ id: 1, name: 'prototype:vite_vue' }]);
// → { prototype: 'vite_vue' }

// Detect execution trigger
const trigger = detectExecutionTrigger('Task description execute');
// → { trigger: 'execute' }

const continueT = detectExecutionTrigger('Task\ncontinue - Add tests');
// → { trigger: 'continue', continuePrompt: 'Add tests' }

// Clean description (remove tags and triggers)
const clean = cleanTaskDescription('Build {{model: opus}} execute');
// → 'Build'
```
</tag_parsing>
