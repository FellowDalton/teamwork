<client_setup>
## Teamwork API Client Setup

The client is located at `apps/teamwork_api_client/`.

**Installation:**
```bash
cd apps/teamwork_api_client
bun install
```

**Environment Variables:**
```bash
TEAMWORK_API_URL=https://yoursite.teamwork.com
TEAMWORK_BEARER_TOKEN=your-api-token
TEAMWORK_PROJECT_ID=123456  # optional default project
```
</client_setup>

<client_initialization>
## Creating a Client

**Low-level client (direct API access):**
```typescript
import { createTeamworkClient } from './apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
  debug: true,  // optional, enables request logging
});

// Access resources
client.tasks      // TasksResource
client.workflows  // WorkflowsResource
client.projects   // ProjectsResource
client.comments   // CommentsResource
client.http       // Direct HTTP access
```

**High-level task monitor:**
```typescript
import { createTaskMonitor } from './apps/teamwork_api_client/src/index.ts';

const monitor = createTaskMonitor({
  defaultProjectId: 123456,  // optional
});

// Simplified operations
await monitor.getEligibleTasks(projectId, ['new'], 10);
await monitor.claimTask(taskId, adwId);
await monitor.completeTask(taskId, adwId, { commitHash: 'abc' });
await monitor.failTask(taskId, adwId, 'Error message');
await monitor.moveTaskToStage(taskId, workflowId, 'In Progress');
```
</client_initialization>

<available_resources>
## Available Resources

| Resource | Purpose | Key Methods |
|----------|---------|-------------|
| `client.tasks` | Task CRUD | `list()`, `listByProject()`, `get()`, `create()`, `update()`, `complete()` |
| `client.workflows` | Board/stage management | `list()`, `getStages()`, `moveTaskToStage()`, `getStageTasks()` |
| `client.projects` | Project management | `list()`, `get()`, `getTasklists()`, `getActiveWorkflow()` |
| `client.comments` | Task comments | `listForTask()`, `createForTask()`, `postMarkdown()`, `postAdwStatusUpdate()` |
| `client.http` | Direct API calls | `get()`, `post()`, `patch()`, `delete()` |
</available_resources>

<direct_api_access>
## Direct API Calls

For endpoints not covered by resources:

```typescript
// GET request
const response = await client.http.get('/projects/api/v3/endpoint.json', {
  param1: 'value',
  param2: 123,
});

// POST request
const response = await client.http.post('/projects/api/v3/endpoint.json', {
  data: {
    field: 'value',
  }
});

// PATCH request
await client.http.patch('/projects/api/v3/endpoint.json', { data: {} });

// DELETE request
await client.http.delete('/projects/api/v3/endpoint.json');
```
</direct_api_access>

<error_handling>
## Error Handling

```typescript
try {
  const result = await client.tasks.get(taskId);
} catch (error) {
  if (error instanceof Error) {
    // Check for API-specific errors
    console.error('API Error:', error.message);

    // Rate limiting returns 429
    if (error.message.includes('429')) {
      console.log('Rate limited, waiting...');
    }

    // Not found returns 404
    if (error.message.includes('404')) {
      console.log('Resource not found');
    }
  }
}
```

The HTTP client includes automatic retry with exponential backoff for rate limits.
</error_handling>

<cli_testing>
## CLI Tool

Test operations from command line:

```bash
cd apps/teamwork_api_client

# List projects
bun run cli list-projects

# List tasks
bun run cli list-tasks <project_id>
bun run cli list-tasks <project_id> new  # filter by status

# List workflows and stages
bun run cli list-workflows
bun run cli list-stages <workflow_id>

# View tasks in stage
bun run cli stage-tasks <workflow_id> <stage_id>

# Move task
bun run cli move-task <task_id> <workflow_id> <stage_id>

# Update status
bun run cli update-status <task_id> completed
```
</cli_testing>
