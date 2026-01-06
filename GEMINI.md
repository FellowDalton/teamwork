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
├── .factory/skills/           # Factory skills for Teamwork operations
│   ├── manage-teamwork/       # Task, project, workflow management
│   └── data-visualization/    # Chart and visualization generation
└── docs/                      # Documentation
```

## Apps

### teamwork_api_client

TypeScript client for Teamwork.com API v3. Supports tasks, projects, workflows, time entries, budgets, and tags.

```typescript
import {
  createTeamworkClient,
  createTaskMonitor,
} from "./apps/teamwork_api_client/src/index.ts";

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

## Skills

### manage-teamwork

Use for any Teamwork.com operations. Invoke with: `\manage-teamwork`

**Available workflows** (in `.factory/skills/manage-teamwork/workflows/`):
| Workflow | Purpose |
|----------|---------|
| `get-tasks.md` | Query tasks by project, status, assignee |
| `create-task.md` | Create tasks and subtasks |
| `create-tasklist.md` | Create task lists in projects |
| `create-project.md` | Create full projects with structure |
| `move-task.md` | Move tasks between board stages |
| `comment-on-task.md` | Add comments to tasks |
| `log-time.md` | Log time entries |
| `get-activity-status.md` | Report on work activity |
| `get-budget.md` | View project budget/utilization |
| `manage-projects.md` | List/get project details |

### data-visualization

Use for generating charts and visualizations. See `.factory/skills/data-visualization/skill.md`.

**Key components:**

- `MiniChart` - Flexible chart component
- `ChartCard` - Styled wrapper
- `chartDataTransform.ts` - Data grouping utilities

## Creating New Workflows

1. **Create workflow file** in `.factory/skills/manage-teamwork/workflows/`:

````markdown
# Workflow: [Name]

## Purpose

[What this workflow does]

## Required Information

- [ ] Item 1
- [ ] Item 2

## Steps

### Step 1: [Action]

```typescript
// Code example
```
````

### Step 2: [Action]

...

## Success Criteria

- [ ] Criteria 1
- [ ] Criteria 2

````

2. **Add to SKILL.md** routing table in `.factory/skills/manage-teamwork/SKILL.md`

3. **Add reference docs** if needed in `references/` folder

## Common Operations

### Create a task
```typescript
const task = await client.tasks.create(tasklistId, {
  name: 'Task name',
  description: 'Details',
  priority: 'high',
  dueAt: '2024-12-31T00:00:00Z',
});
````

### Log time

```typescript
await client.timeEntries.create({
  taskId: 12345,
  minutes: 60,
  date: "2024-12-15",
  description: "Work done",
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

## Runtime

Use **Bun** instead of Node.js:

- `bun <file>` instead of `node <file>`
- `bun test` instead of jest/vitest
- `bun install` instead of npm install
- Bun auto-loads `.env` files

## Executing Reusable Prompts

When engineer uses `\<prompt>`:

- **Standard prompts**: `\<prompt>` → `.claude/commands/<prompt>.md`
- **Nested prompts**: `\sandbox:host` → `.claude/commands/sandbox/host.md`
- **Skills**: `\manage-teamwork` → `.factory/skills/manage-teamwork/SKILL.md`
