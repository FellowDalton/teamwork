# Claude Code Skills Export

This folder contains Claude Code skills and the skill activation hook system for managing Teamwork.com projects and Railway deployments.

## Contents

```
skill-export/
├── README.md                          # This file
└── .claude/
    ├── skills/
    │   ├── skill-rules.json           # Skill activation configuration
    │   ├── manage-teamwork/           # Teamwork.com skill
    │   │   ├── SKILL.md
    │   │   ├── references/
    │   │   └── workflows/
    │   └── railway-cli/               # Railway deployment skill
    │       └── SKILL.md
    └── hooks/
        └── SkillActivationHook/       # Auto-suggest skills based on prompts
            ├── skill-activation-prompt.mjs
            ├── skill-activation-prompt.sh
            ├── skill-activation-prompt.cmd
            └── .gitignore
```

---

## Setup Instructions

### 1. Copy files to your project

```bash
# From skill-export folder to your target project
cp -r .claude /path/to/your/project/
```

### 2. Configure `.claude/settings.local.json`

Create or update `.claude/settings.local.json` in your target project:

**Linux/Mac:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/SkillActivationHook/skill-activation-prompt.sh"
          }
        ]
      }
    ]
  }
}
```

**Windows:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cmd /c \".claude\\hooks\\SkillActivationHook\\skill-activation-prompt.cmd\""
          }
        ]
      }
    ]
  }
}
```

### 3. Make scripts executable (Linux/Mac)

```bash
chmod +x .claude/hooks/SkillActivationHook/*.sh
```

### 4. Set environment variables

Add these to your `.env` file or shell profile:

```bash
# Teamwork API
TEAMWORK_API_URL=https://yoursite.teamwork.com
TEAMWORK_BEARER_TOKEN=your-api-token
TEAMWORK_PROJECT_ID=123456  # optional default project

# Webhook secret (optional, for HMAC verification)
WEBHOOK_SECRET=your-secret-token
```

### 5. Install API client dependencies

```bash
cd /Users/dalton/projects/teamwork/apps/teamwork_api_client
bun install
```

---

## Using the Skills

Once configured, the skill activation hook will automatically suggest relevant skills when you type prompts containing keywords like:

- **Teamwork:** "task", "project", "log time", "move task", "kanban"
- **Railway:** "deploy", "502 error", "railway logs", "environment variables"

The suggestion appears before Claude responds:

```
🎯 SKILL ACTIVATION CHECK

📚 RECOMMENDED SKILLS:
  → manage-teamwork

ACTION: Use Skill tool BEFORE responding
```

---

## Teamwork Webhooks: Listening for "In Progress" Tasks

To automatically trigger actions when tasks are moved to "In Progress" in Teamwork, you need to set up webhooks.

### Overview

The workflow:
1. Task with `FellowAI` tag is moved to "In Progress" stage in Teamwork
2. Teamwork sends webhook event to your server
3. Your server processes the task description as an AI prompt
4. Results are posted back as a comment on the task

### Setting Up Webhooks

#### Option 1: Interactive Setup (Recommended)

```bash
cd /Users/dalton/projects/teamwork
bun scripts/webhooks/setup.ts
```

This will:
1. Check if your server is running
2. Start ngrok tunnel for local development
3. Register webhooks with Teamwork

#### Option 2: Manual Setup

**Step 1: Start ngrok tunnel**
```bash
ngrok http 3001
```

**Step 2: Register webhook with Teamwork**
```typescript
import { createTeamworkClient } from '/Users/dalton/projects/teamwork/apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// Create webhook for TASK.MOVED events
await client.webhooks.createTaskMovedWebhook(
  'https://your-ngrok-url.ngrok.io/api/webhooks/teamwork',
  { token: process.env.WEBHOOK_SECRET }
);
```

**Step 3: Handle webhook in your server**
```typescript
// Example webhook handler
app.post('/api/webhooks/teamwork', async (req, res) => {
  const payload = req.body;

  // Check if it's a TASK.MOVED event
  if (payload.event === 'TASK.MOVED') {
    const task = payload.task;

    // Check for "FellowAI" tag
    const hasFellowAITag = task?.tags?.some(t =>
      t.name.toLowerCase() === 'fellowai'
    );

    // Check if moved to "In Progress" stage
    const isInProgress = task?.workflowsStages?.some(s =>
      s.stageName?.toLowerCase().includes('in progress')
    );

    if (hasFellowAITag && isInProgress && task?.description) {
      // Execute the task description as an AI prompt
      console.log(`Executing task: ${task.name}`);
      // ... your AI execution logic here
    }
  }

  res.status(200).send('OK');
});
```

### Webhook Event Payload

When a task is moved, Teamwork sends:

```json
{
  "event": "TASK.MOVED",
  "accountId": 123456,
  "eventCreator": {
    "id": 789,
    "firstName": "John",
    "lastName": "Doe"
  },
  "task": {
    "id": 12345,
    "name": "Build authentication feature",
    "description": "Implement OAuth2 login...",
    "projectId": 67890,
    "status": "active",
    "tags": [
      { "id": 1, "name": "FellowAI", "color": "#ff0000" }
    ],
    "workflowsStages": [
      { "stageId": 100, "workflowId": 50, "stageName": "In Progress" }
    ]
  },
  "project": {
    "id": 67890,
    "name": "My Project"
  }
}
```

### Webhook API Reference

```typescript
// List all webhooks
const webhooks = await client.webhooks.list();

// Create webhook for specific event
await client.webhooks.create({
  url: 'https://your-server.com/webhook',
  event: 'TASK',
  status: 'MOVED',  // CREATED, UPDATED, MOVED, COMPLETED, etc.
  contentType: 'application/json',
  version: 2,
  token: 'your-secret',  // for HMAC verification
});

// Create webhooks for all task events
await client.webhooks.createAllTaskWebhooks('https://your-server.com/webhook', {
  token: 'your-secret',
});

// Delete webhook
await client.webhooks.delete(webhookId);
```

### Available Webhook Events

| Event Type | Actions |
|------------|---------|
| `TASK` | CREATED, DELETED, UPDATED, COMPLETED, MOVED, REOPENED |
| `PROJECT` | CREATED, DELETED, UPDATED, ARCHIVED |
| `COMMENT` | CREATED, DELETED, UPDATED |
| `TIME` | CREATED, DELETED, UPDATED |
| `MILESTONE` | CREATED, DELETED, UPDATED, COMPLETED |

---

## Troubleshooting

### Skill activation not working

1. Verify settings.local.json has the hook configured
2. Test the hook directly:
   ```bash
   echo '{"session_id":"test","prompt":"create a task"}' | bash .claude/hooks/SkillActivationHook/skill-activation-prompt.sh
   ```
3. Check that Node.js is available in PATH

### Webhook not receiving events

1. Verify ngrok is running: `curl http://127.0.0.1:4040/api/tunnels`
2. Check Teamwork webhook settings: Settings → Integrations → Webhooks
3. Test webhook URL is accessible from internet
4. Check your server logs for incoming requests

### API errors

1. Verify environment variables are set
2. Test API connection:
   ```bash
   cd /Users/dalton/projects/teamwork/apps/teamwork_api_client
   bun run cli list-projects
   ```

---

## Global Paths Reference

All skills in this export use absolute paths to the API client:

```
/Users/dalton/projects/teamwork/apps/teamwork_api_client/src/index.ts
```

If you move the API client, update these paths in:
- `.claude/skills/manage-teamwork/SKILL.md`
- `.claude/skills/manage-teamwork/references/*.md`
- `.claude/skills/manage-teamwork/workflows/*.md`

---

## Quick Reference

### Start backend server
```bash
cd /Users/dalton/projects/teamwork/apps/teamwork_backend
bun run dev
```

### Start webhook tunnel
```bash
ngrok http 3001
```

### Register webhook
```bash
cd /Users/dalton/projects/teamwork
bun scripts/webhooks/setup.ts
```

### Test API client
```bash
cd /Users/dalton/projects/teamwork/apps/teamwork_api_client
bun run cli list-projects
bun run cli list-tasks <project_id>
```
