# Teamwork API Client

A TypeScript client for Teamwork.com API v3 with full workflow/stage support. Built with Bun and Zod for type-safe API interactions.

## Why This Exists

The Teamwork MCP server doesn't expose workflow endpoints. This client provides:
- **Direct REST API access** (bypasses MCP)
- **Workflow & stage management** (Kanban board operations)
- **Task movement between stages**
- **Drop-in replacement** for MCP-based `/get_teamwork_tasks` and `/update_teamwork_task`

## Installation

```bash
cd apps/teamwork_api_client
bun install
```

## Configuration

Set environment variables:

```bash
export TEAMWORK_API_URL="https://yoursite.teamwork.com"
export TEAMWORK_BEARER_TOKEN="your-api-token"
export TEAMWORK_PROJECT_ID="123456"  # optional default project
```

Or use a `.env` file in the project root.

## Usage

### High-Level Task Monitor (Recommended)

Drop-in replacement for MCP-based task operations:

```typescript
import { createTaskMonitor } from './src/index.ts';

const monitor = createTaskMonitor();

// Get tasks eligible for automated processing
// (tasks with 'execute' or 'continue - prompt' triggers)
const tasks = await monitor.getEligibleTasks(projectId, ['new', 'pending'], 10);

// Claim a task
await monitor.claimTask(taskId, adwId, { model: 'sonnet' });

// Move task to a workflow stage by name
await monitor.moveTaskToStage(taskId, workflowId, 'In Progress');

// Complete task with commit hash
await monitor.completeTask(taskId, adwId, { commitHash: 'abc123' });

// Mark task as failed
await monitor.failTask(taskId, adwId, 'Error message');
```

### Low-Level Client

For direct API access:

```typescript
import { createTeamworkClient } from './src/index.ts';

const client = createTeamworkClient({
  apiUrl: 'https://yoursite.teamwork.com',
  bearerToken: 'your-token',
  debug: true,
});

// Tasks
const tasks = await client.tasks.listByProject(projectId, { statuses: ['new'] });
await client.tasks.update(taskId, { status: 'active' });
await client.tasks.complete(taskId);

// Workflows & Stages
const workflows = await client.workflows.list({ include: ['stages'] });
const stages = await client.workflows.getStages(workflowId);
const stageTasks = await client.workflows.getStageTasks(workflowId, stageId);
await client.workflows.moveTaskToStage(taskId, workflowId, stageId);

// Projects
const projects = await client.projects.list({ status: 'active' });
const workflow = await client.projects.getActiveWorkflow(projectId);

// Comments
await client.comments.postAdwStatusUpdate(taskId, {
  adwId: 'abc123',
  status: 'In Progress',
  message: 'Starting work...',
});
```

### Tag Parsing Utilities

```typescript
import {
  extractInlineTags,
  parseNativeTags,
  detectExecutionTrigger
} from './src/index.ts';

// Extract {{key: value}} tags from description
extractInlineTags('Build app {{model: opus}} {{prototype: vite_vue}}');
// → { model: 'opus', prototype: 'vite_vue' }

// Parse native Teamwork tags (key:value format)
parseNativeTags([{ id: 1, name: 'prototype:vite_vue' }]);
// → { prototype: 'vite_vue' }

// Detect execution triggers
detectExecutionTrigger('Task description execute');
// → { trigger: 'execute' }

detectExecutionTrigger('Original task\ncontinue - Add error handling');
// → { trigger: 'continue', continuePrompt: 'Add error handling' }
```

## CLI Tool

Test the API from the command line:

```bash
# Show help
bun run cli --help

# List projects
bun run cli list-projects

# List tasks in a project
bun run cli list-tasks <project_id>
bun run cli list-tasks <project_id> new    # filter by status

# List workflows and stages
bun run cli list-workflows
bun run cli list-stages <workflow_id>

# List tasks in a specific stage
bun run cli stage-tasks <workflow_id> <stage_id>

# Get eligible tasks for ADW processing
bun run cli eligible-tasks <project_id>

# Move task to a stage
bun run cli move-task <task_id> <workflow_id> <stage_id>

# Update task status
bun run cli update-status <task_id> completed
```

## Testing

```bash
bun test
```

50 tests covering:
- HTTP client with retry logic
- Tag extraction and parsing
- Execution trigger detection

## Architecture

```
src/
├── client.ts          # Core HTTP client (auth, retry, rate limiting)
├── types.ts           # Zod schemas for API responses
├── index.ts           # Main exports
├── cli.ts             # CLI tool
├── task-monitor.ts    # High-level facade
└── resources/
    ├── tasks.ts       # Task CRUD operations
    ├── workflows.ts   # Workflow & stage management
    ├── projects.ts    # Project operations
    └── comments.ts    # Comment posting
```

## Integration with ADW System

This client is designed to integrate with the `adws-bun/` trigger system:

1. Replace MCP calls with `TeamworkTaskMonitor` methods
2. Use `getEligibleTasks()` to poll for work
3. Use `moveTaskToStage()` to track progress on Kanban boards
4. Use `completeTask()` / `failTask()` to update final status

## API Reference

See `specs/plan-teamwork_api_client-bun-scripts.md` for the implementation plan and API documentation.
