# Workflow: Move Task Between Board Stages

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
2. references/workflow-operations.md (for board/stage operations)
</required_reading>

<process>
## Step 1: Understand the Hierarchy

```
Project → Workflow → Stages (columns on the board)
                └── Stage 1 (e.g., "To Do")
                └── Stage 2 (e.g., "In Progress")
                └── Stage 3 (e.g., "Done")
```

You need: Task ID, Workflow ID, and Target Stage ID (or name).

## Step 2: Get Project's Active Workflow

```typescript
import { createTeamworkClient } from './apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// Get the active workflow for a project
const workflow = await client.projects.getActiveWorkflow(PROJECT_ID);
if (!workflow) {
  throw new Error('No active workflow for this project');
}
console.log(`Workflow: ${workflow.id} - ${workflow.name}`);
```

## Step 3: List Available Stages

```typescript
const stages = await client.workflows.getStages(WORKFLOW_ID);
console.log('Available stages:');
for (const stage of stages) {
  console.log(`- [${stage.id}] ${stage.name}`);
}
```

## Step 4: Move Task by Stage ID

```typescript
await client.workflows.moveTaskToStage(
  TASK_ID,
  WORKFLOW_ID,
  STAGE_ID
);
console.log('Task moved successfully');
```

## Step 5: Move Task by Stage Name (High-Level)

Using the task monitor facade:

```typescript
import { createTaskMonitor } from './apps/teamwork_api_client/src/index.ts';

const monitor = createTaskMonitor();

// Find stage by name and move
await monitor.moveTaskToStage(TASK_ID, WORKFLOW_ID, 'In Progress');
```

## Step 6: View Tasks in a Stage

```typescript
const response = await client.workflows.getStageTasks(
  WORKFLOW_ID,
  STAGE_ID,
  { include: ['tags', 'assignees'] }
);

console.log(`Tasks in stage:`);
for (const task of response.tasks) {
  console.log(`- [${task.id}] ${task.name}`);
}
```

## Step 7: Get Backlog (Unassigned to Any Stage)

```typescript
const backlog = await client.workflows.getBacklogTasks(WORKFLOW_ID);
console.log(`Backlog tasks: ${backlog.tasks.length}`);
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Workflow ID identified for the project
- [ ] Target stage ID or name identified
- [ ] Task moved via `moveTaskToStage()`
- [ ] Task appears in correct stage (verify if needed)
</success_criteria>
