# Spec: Auto-execute AI Tasks on Board Movement

## Overview
When a task with the `FellowAI` tag is moved to the "In Progress" board column, automatically execute the task description as a prompt using the agent-sdk.

## Trigger Conditions
1. Webhook event: `TASK.MOVED`
2. Task has tag: `FellowAI`
3. Task moved to stage: "In Progress"

## Changes Required

### 1. Update webhook payload interface (`server-sdk.ts`)
Add `tags` and `workflowsStages` to the `TeamworkWebhookPayload` interface:

```typescript
interface TeamworkWebhookPayload {
  eventCreator?: { id: number; firstName?: string; lastName?: string };
  task?: {
    id: number;
    name: string;
    description?: string;
    projectId?: number;
    taskListId?: number;
    status?: string;
    tags?: Array<{ id: number; name: string; color?: string }>;
    workflowsStages?: Array<{ stageId: number; workflowId: number; stageName?: string }>;
  };
  project?: { id: number; name: string };
  event: string;
  accountId?: number;
}
```

### 2. Create task execution function (`server-sdk.ts`)
New `executeAITask()` function that:
- Takes task ID and description as prompt
- Runs it through `query()` with agent-sdk
- Posts results back as a comment on the task
- Optionally moves task to next stage (e.g., "Review")

```typescript
async function executeAITask(task: {
  id: number;
  name: string;
  description: string;
  projectId?: number;
}): Promise<void> {
  console.log(`[AI Task] Executing: ${task.name} (ID: ${task.id})`);
  
  const options: Options = {
    model: 'claude-sonnet-4-20250514',
    cwd: process.cwd(),
    env: cleanEnv,
    pathToClaudeCodeExecutable: '/Users/dalton/.nvm/versions/node/v20.19.5/bin/claude',
  };
  
  let resultText = '';
  for await (const event of query({ prompt: task.description, options })) {
    if (event.type === 'result' && event.subtype === 'success') {
      resultText = event.result || '';
    }
  }
  
  // Post result as comment on task
  if (resultText) {
    await teamworkClient.comments.create(task.id, {
      body: `## AI Execution Result\n\n${resultText}`,
    });
  }
  
  console.log(`[AI Task] Completed: ${task.name}`);
}
```

### 3. Modify `handleWebhook()` (`server-sdk.ts`)
Add detection and execution logic:

```typescript
if (eventType === 'TASK.MOVED') {
  const task = payload.task;
  
  // Check for "FellowAI" tag
  const hasFellowAITag = task?.tags?.some(t => 
    t.name.toLowerCase() === 'fellowai'
  );
  
  // Check if moved to "In Progress" stage
  const isInProgressStage = task?.workflowsStages?.some(s => 
    s.stageName?.toLowerCase().includes('in progress')
  );
  
  if (hasFellowAITag && isInProgressStage && task?.description) {
    // Execute asynchronously - don't block webhook response
    executeAITask({
      id: task.id,
      name: task.name,
      description: task.description,
      projectId: task.projectId,
    }).catch(err => {
      console.error('[AI Task] Execution failed:', err);
    });
  }
}
```

## Open Questions

1. **Stage detection**: Match by stage name "In Progress" or specific stage ID?
2. **Output handling**: 
   - Post as comment on task? ✓
   - Move task to next stage (e.g., "Review")?
   - Update task status?
3. **Tag name**: `FellowAI` (confirmed)
4. **Error handling**: What to do if AI execution fails?
   - Post error as comment?
   - Move to "Failed" stage?

## Success Criteria
- [ ] Webhook correctly detects `FellowAI` tagged tasks
- [ ] Stage detection works for "In Progress" column
- [ ] Task description is executed via agent-sdk
- [ ] Results are posted back to the task
- [ ] Webhook responds quickly (async execution)
