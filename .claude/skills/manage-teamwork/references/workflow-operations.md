<workflow_concepts>
## Workflows and Stages

Workflows are Kanban-style boards with stages (columns).

```
Project
  └── Workflow (e.g., "Sprint Board")
        ├── Stage 1: "To Do"
        ├── Stage 2: "In Progress"
        ├── Stage 3: "Review"
        └── Stage 4: "Done"
```

Tasks can be placed in stages and moved between them.
</workflow_concepts>

<listing_workflows>
## Listing Workflows

```typescript
// All workflows
const response = await client.workflows.list({
  include: ['stages'],
  pageSize: 50,
});

// Workflows for a project
const projectWorkflows = await client.workflows.listByProject(projectId, ['stages']);

// Get single workflow
const workflow = await client.workflows.get(workflowId, ['stages']);
```
</listing_workflows>

<list_options>
## Workflow List Options

| Option | Type | Description |
|--------|------|-------------|
| `projectIds` | `number[]` | Filter by projects |
| `workflowIds` | `number[]` | Filter by workflow IDs |
| `stageNames` | `string[]` | Filter by stage names |
| `searchTerm` | `string` | Search term |
| `include` | `string[]` | Include: `stages`, `projects`, `users`, `teams`, `companies` |
| `onlyDefaultWorkflow` | `boolean` | Only return default workflow |
| `includeArchived` | `boolean` | Include archived workflows |
| `page` | `number` | Page number |
| `pageSize` | `number` | Items per page |
</list_options>

<stage_operations>
## Stage Operations

**Get stages for a workflow:**
```typescript
const stages = await client.workflows.getStages(workflowId);
for (const stage of stages) {
  console.log(`${stage.id}: ${stage.name}`);
}
```

**Get single stage:**
```typescript
const stage = await client.workflows.getStage(workflowId, stageId);
```

**Find stage by name:**
```typescript
const stage = await client.workflows.findStageByName(workflowId, 'In Progress');
if (stage) {
  console.log(`Stage ID: ${stage.id}`);
}
```
</stage_operations>

<stage_tasks>
## Tasks in Stages

**Get tasks in a stage:**
```typescript
const response = await client.workflows.getStageTasks(workflowId, stageId, {
  include: ['tags', 'assignees'],
  pageSize: 50,
});

for (const task of response.tasks) {
  console.log(`- ${task.name}`);
}
```

**Get backlog (tasks not in any stage):**
```typescript
const backlog = await client.workflows.getBacklogTasks(workflowId, {
  include: ['tags'],
});
```

**Get all tasks across all stages:**
```typescript
const allTasks = await client.workflows.getAllWorkflowTasks(workflowId, {
  include: ['tags', 'assignees'],
});
// Returns Map<stageId, TaskListResponse>
```
</stage_tasks>

<moving_tasks>
## Moving Tasks Between Stages

**By stage ID:**
```typescript
await client.workflows.moveTaskToStage(
  taskId,
  workflowId,
  stageId,
  positionAfterCard  // optional: position in column
);
```

**By stage name (using monitor):**
```typescript
const monitor = createTaskMonitor();
await monitor.moveTaskToStage(taskId, workflowId, 'In Progress');
```

**Add task to stage:**
```typescript
await client.workflows.addTaskToStage(workflowId, stageId, taskId);

// Add multiple tasks
await client.workflows.addTasksToStage(workflowId, stageId, [taskId1, taskId2]);
```
</moving_tasks>

<project_workflow>
## Project Workflow Management

**Get active workflow for project:**
```typescript
const workflow = await client.projects.getActiveWorkflow(projectId);
if (workflow) {
  console.log(`Active: ${workflow.id} - ${workflow.name}`);
}
```

**Apply workflow to project:**
```typescript
await client.projects.applyWorkflow(projectId, workflowId);
```

**Remove workflow from project:**
```typescript
await client.projects.removeWorkflow(projectId, workflowId);
```
</project_workflow>

<common_patterns>
## Common Patterns

**Get all stages and their tasks for a project:**
```typescript
// 1. Get project's workflow
const workflow = await client.projects.getActiveWorkflow(projectId);
if (!workflow) throw new Error('No workflow');

// 2. Get stages
const stages = await client.workflows.getStages(workflow.id);

// 3. Get tasks per stage
for (const stage of stages) {
  const response = await client.workflows.getStageTasks(workflow.id, stage.id);
  console.log(`\n${stage.name}: ${response.tasks.length} tasks`);
  for (const task of response.tasks) {
    console.log(`  - ${task.name}`);
  }
}
```

**Move task through workflow:**
```typescript
const monitor = createTaskMonitor();

// Start → In Progress
await monitor.moveTaskToStage(taskId, workflowId, 'In Progress');

// ... do work ...

// In Progress → Review
await monitor.moveTaskToStage(taskId, workflowId, 'Review');

// Review → Done
await monitor.moveTaskToStage(taskId, workflowId, 'Done');
```
</common_patterns>
