# Teamwork Project

AI-powered Teamwork.com management system with chat interface and API client.

## Project Structure

```
teamwork/
├── apps/
│   ├── teamwork_api_client/   # TypeScript API client for Teamwork.com
│   └── teamwork_frontend/     # React chat interface with AI agents
├── scripts/
│   └── analysis/              # Time tracking analysis scripts
├── prompts/
│   └── agents/                # Agent system prompts (timelog, project, etc.)
├── .claude/skills/            # Claude Code skills for Teamwork operations
│   └── manage-teamwork/       # Task, project, workflow management
└── docs/                      # Documentation
```

## Apps

### teamwork_api_client

TypeScript client for Teamwork.com API v3. Supports tasks, projects, workflows, time entries, budgets, and tags.

```typescript
import { createTeamworkClient, createTaskMonitor } from './apps/teamwork_api_client/src/index.ts';

// Low-level client
const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// High-level task operations
const monitor = createTaskMonitor();
```

**Run tests:** `cd apps/teamwork_api_client && bun test`

### teamwork_frontend

React chat interface with AI agents for managing Teamwork. Features:
- Chat with AI to create projects, log time, check status
- Draft review system (projects, time entries reviewed before submission)
- Data visualization panel
- Multi-agent architecture (timelog, project, status agents)

**Run dev server:** `cd apps/teamwork_frontend && bun run server.ts`

## Environment Variables

```bash
# Teamwork API
TEAMWORK_API_URL=https://yoursite.teamwork.com
TEAMWORK_BEARER_TOKEN=your-api-token
TEAMWORK_PROJECT_ID=123456  # optional default

# AI (for frontend agents)
ANTHROPIC_API_KEY=your-key
```

## Runtime

Use **Bun** instead of Node.js:
- `bun <file>` instead of `node <file>`
- `bun test` instead of jest/vitest
- `bun install` instead of npm install
- Bun auto-loads `.env` files

## Common Operations

### Create a task
```typescript
const task = await client.tasks.create(tasklistId, {
  name: 'Task name',
  description: 'Details',
  priority: 'high',
  dueAt: '2024-12-31T00:00:00Z',
});
```

### Log time
```typescript
await client.timeEntries.create({
  taskId: 12345,
  minutes: 60,
  date: '2024-12-15',
  description: 'Work done',
  isBillable: true,
});
```

### Move task to board stage
```typescript
await client.workflows.moveTaskToStage(taskId, workflowId, stageId);
```

### Get project budget
```typescript
const budget = await client.budgets.getActiveByProject(projectId);
const utilization = await client.budgets.getUtilization(projectId);
```
