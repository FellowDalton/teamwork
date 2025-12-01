# What Happens When You Run `bun run trigger:teamwork`

## Quick Summary

The Teamwork monitor continuously polls your Teamwork project every 15 seconds, looking for tasks that are ready to be automated. When it finds eligible tasks, it:
1. Claims them (updates status to "In progress")
2. Spawns a detached workflow process to handle the task
3. Continues monitoring for more tasks

## Detailed Step-by-Step Flow

### 1. Startup (Lines 364-403)

```bash
$ cd adws-bun
$ bun run trigger:teamwork
```

**What happens:**
```
[2025-11-11T16:50:00Z] [INFO] Starting Teamwork task monitor
[2025-11-11T16:50:00Z] [INFO] Project ID: 12345
[2025-11-11T16:50:00Z] [INFO] Polling interval: 15s
[2025-11-11T16:50:00Z] [INFO] Max concurrent tasks: 3
[2025-11-11T16:50:00Z] [INFO] Status filter: New, Review
[2025-11-11T16:50:00Z] [INFO] Dry run: false
```

**Configuration loaded from:**
- `TEAMWORK_PROJECT_ID` env variable (required)
- `--interval N` flag or default 15 seconds
- `--max-tasks N` flag or default 3 tasks
- `--dry-run` flag or default false

### 2. Polling Cycle Begins (Lines 342-357)

Every 15 seconds, the monitor runs `runOnce()`:

```
--- Cycle 1 ---
=== Starting polling cycle ===
Fetching tasks from Teamwork project 12345
```

### 3. Fetch Tasks from Teamwork (Lines 73-123)

**The monitor calls:** `/get_teamwork_tasks` slash command

```typescript
const request = {
  slashCommand: '/get_teamwork_tasks',
  args: [projectId, '["New","Review"]', '10'],
  adwId: 'abc12345',
  model: 'sonnet'
};
```

**Behind the scenes:**
- Uses Claude Code CLI with MCP to query Teamwork
- Fetches up to 10 tasks with status "New" or "Review"
- Returns JSON array of tasks

**Example response:**
```json
[
  {
    "task_id": "999001",
    "title": "Add user authentication",
    "description": "Implement JWT authentication...\n\nexecute",
    "status": "New",
    "tags": {
      "model": "sonnet",
      "prototype": "vite_vue"
    }
  }
]
```

### 4. Filter Eligible Tasks (Lines 100-122)

For each task returned, the monitor checks eligibility:

```typescript
isTeamworkTaskEligibleForProcessing(task)
```

**A task is eligible if:**
- ✅ Status is "New" or "Review"
- ✅ Has execution trigger (`execute` or `continue - ...`) in description
- ✅ Not already claimed (no existing ADW ID in metadata)
- ✅ Has valid tags (if any)

**Logs for eligible task:**
```
[INFO] Found eligible task: 999001 - Add user authentication
```

**Logs for ineligible task:**
```
[DEBUG] Skipping ineligible task: 999002
```

### 5. Delegate Task (Lines 162-258)

For each eligible task, the monitor:

#### 5a. Generate ADW ID
```typescript
const adwId = generateShortId(); // e.g., "abc12345"
```

#### 5b. Determine Workflow Parameters
```typescript
const model = getTeamworkPreferredModel(task); // "sonnet" or "opus"
const worktreeName = task.tags.worktree || generateWorktreeName(task);
const taskPrompt = getTeamworkTaskPromptForAgent(task);
```

**Example:**
```
[INFO] Delegating task 999001 with ADW ID abc12345
[INFO]   Model: sonnet
[INFO]   Worktree: proto-add-user-authentication
[INFO]   Workflow: plan-implement (vite_vue)
```

#### 5c. Claim Task Immediately (Lines 192-206)

**Updates Teamwork task to "In progress":**
```json
{
  "status": "In progress",
  "adw_id": "abc12345",
  "timestamp": "2025-11-11T16:50:15Z",
  "model": "sonnet",
  "worktree_name": "proto-add-user-authentication"
}
```

**This prevents other monitors (or parallel runs) from picking up the same task.**

#### 5d. Determine Workflow Script (Lines 208-221)

**Three workflow types:**

1. **Prototype workflow** (has `prototype:vite_vue` tag):
   ```typescript
   scriptPath = './adws-bun/src/workflows/adw-plan-implement-update-teamwork-task.ts'
   scriptArgs = [adwId, taskId, prompt, worktree, 'vite_vue', model, projectId]
   ```

2. **Plan-implement workflow** (has `workflow:plan` tag or long description):
   ```typescript
   scriptPath = './adws-bun/src/workflows/adw-plan-implement-update-teamwork-task.ts'
   scriptArgs = [adwId, taskId, prompt, worktree, '', model, projectId]
   ```

3. **Build workflow** (simple tasks):
   ```typescript
   scriptPath = './adws-bun/src/workflows/adw-build-update-teamwork-task.ts'
   scriptArgs = [adwId, taskId, prompt, worktree, model, projectId]
   ```

#### 5e. Spawn Detached Workflow Process (Lines 229-242)

**The key part - using Bun.spawn():**

```typescript
const proc = Bun.spawn({
  cmd: [scriptPath, ...scriptArgs],
  env: getSafeSubprocessEnv(),
  stdout: 'ignore',
  stderr: 'ignore',
  stdin: 'ignore',
  detached: true,  // ← Runs independently
});

proc.unref();  // ← Parent doesn't wait for it
```

**What this means:**
- The workflow runs in a **completely separate process**
- The monitor doesn't wait for it to finish
- The workflow continues even if the monitor crashes/restarts
- Multiple workflows can run in parallel

**Log:**
```
[INFO] Successfully spawned workflow for task 999001
```

### 6. Continue Polling (Lines 350-352)

```
[INFO] === Polling cycle complete: 1/1 tasks delegated ===
[INFO] Sleeping for 15s...
```

**The monitor waits 15 seconds, then repeats from step 2.**

### 7. Workflow Execution (Happens in Separate Process)

While the monitor continues polling, the spawned workflow:

1. **Creates worktree** (if needed)
   ```bash
   git worktree add ../trees/proto-add-user-authentication --sparse-checkout
   ```

2. **Executes slash commands** (e.g., `/plan_vite_vue`, `/implement`)
   ```typescript
   // In the workflow script:
   await executeTemplate({
     slashCommand: '/plan_vite_vue',
     args: [adwId, taskPrompt],
     // ...
   });
   ```

3. **Uses Claude Code to write code**
   - Reads files
   - Edits files
   - Creates new files
   - Runs tests
   - Commits changes

4. **Updates Teamwork** when done
   ```typescript
   await executeTemplate({
     slashCommand: '/update_teamwork_task',
     args: [taskId, 'Done', JSON.stringify({ commit: hash })],
     // ...
   });
   ```

**Log (in workflow process):**
```
[INFO] === Starting Build Workflow ===
[INFO] ADW ID: abc12345
[INFO] Task ID: 999001
[INFO] Executing /build command...
[INFO] Build completed successfully
[INFO] Commit hash: a1b2c3d
[INFO] Updating Teamwork task to Done...
[INFO] === Build Workflow Complete ===
```

### 8. Monitor Continues Indefinitely

```
--- Cycle 2 ---
=== Starting polling cycle ===
Fetching tasks from Teamwork project 12345
[INFO] No eligible tasks found
[INFO] === Polling cycle complete: 0/0 tasks delegated ===
[INFO] Sleeping for 15s...

--- Cycle 3 ---
...
```

**Runs until:**
- You press Ctrl+C (SIGINT)
- System sends SIGTERM
- Fatal error occurs

## Command Line Options

### Run Once (No Continuous Monitoring)
```bash
bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts --once
```
- Runs one polling cycle
- Processes eligible tasks
- Exits immediately

### Dry Run Mode
```bash
bun run trigger:teamwork --dry-run
```
- Fetches tasks
- Logs what it would do
- **Doesn't spawn workflows**
- **Doesn't update Teamwork**

### Custom Interval
```bash
bun run trigger:teamwork --interval 30
```
- Polls every 30 seconds instead of 15

### Limit Concurrent Tasks
```bash
bun run trigger:teamwork --max-tasks 5
```
- Processes up to 5 tasks per cycle instead of 3

### Combined Options
```bash
bun run trigger:teamwork --interval 30 --max-tasks 5 --dry-run --once
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  bun run trigger:teamwork                                   │
│  (adw-trigger-cron-teamwork-tasks.ts)                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├─► 1. Load config from .env
                  │      - TEAMWORK_PROJECT_ID
                  │      - Polling interval (15s)
                  │
                  ├─► 2. Start polling loop (every 15s)
                  │      │
                  │      ├─► 3. Fetch tasks via /get_teamwork_tasks
                  │      │      └─► Claude Code + MCP Teamwork
                  │      │
                  │      ├─► 4. Filter eligible tasks
                  │      │      - Has "execute" trigger
                  │      │      - Status = "New" or "Review"
                  │      │
                  │      └─► 5. For each eligible task:
                  │             │
                  │             ├─► 5a. Generate ADW ID
                  │             │
                  │             ├─► 5b. Claim task (update to "In progress")
                  │             │      └─► /update_teamwork_task
                  │             │
                  │             └─► 5c. Spawn detached workflow
                  │                    │
                  │                    └─► Bun.spawn({ detached: true })
                  │                         │
                  │                         ▼
                  │            ┌────────────────────────────────┐
                  │            │  DETACHED WORKFLOW PROCESS     │
                  │            │  (runs independently)          │
                  │            ├────────────────────────────────┤
                  │            │  1. Create worktree            │
                  │            │  2. Execute slash commands     │
                  │            │  3. Write code via Claude      │
                  │            │  4. Commit changes             │
                  │            │  5. Update Teamwork to "Done"  │
                  │            └────────────────────────────────┘
                  │
                  ├─► 6. Sleep for 15 seconds
                  │
                  └─► 7. Repeat from step 2
```

## Key Features

### 1. Detached Execution ✅
- Workflows run independently
- Monitor doesn't wait
- Workflows survive monitor restart
- True parallel processing

### 2. Task Claiming ✅
- Immediately updates status to "In progress"
- Prevents duplicate processing
- Stores ADW ID in task metadata
- Other monitors skip claimed tasks

### 3. Graceful Shutdown ✅
```typescript
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  shouldStop = true;
});
```
- Ctrl+C stops after current cycle
- Doesn't kill running workflows
- Clean exit

### 4. Error Handling ✅
- Failed task fetches → log and continue
- Failed task claiming → skip and continue
- Failed workflow spawn → update task to "Failed"
- Fatal errors → exit with error code

### 5. No Subprocess Rate Limiting ✅
```typescript
// Bun.spawn() works perfectly - no rate limiting!
const proc = Bun.spawn({
  cmd: [scriptPath, ...scriptArgs],
  env: getSafeSubprocessEnv(),
  detached: true,
});
```

## Example Session Output

```bash
$ cd adws-bun
$ bun run trigger:teamwork

[2025-11-11T16:50:00Z] [INFO] Starting Teamwork task monitor
[2025-11-11T16:50:00Z] [INFO] Project ID: 12345
[2025-11-11T16:50:00Z] [INFO] Polling interval: 15s
[2025-11-11T16:50:00Z] [INFO] Max concurrent tasks: 3
[2025-11-11T16:50:00Z] [INFO] Status filter: New, Review
[2025-11-11T16:50:00Z] [INFO] Dry run: false

[2025-11-11T16:50:00Z] [INFO] --- Cycle 1 ---
[2025-11-11T16:50:00Z] [INFO] === Starting polling cycle ===
[2025-11-11T16:50:00Z] [INFO] Fetching tasks from Teamwork project 12345
[2025-11-11T16:50:02Z] [INFO] Found eligible task: 999001 - Add user authentication
[2025-11-11T16:50:02Z] [INFO] Found eligible task: 999002 - Fix bug in payment flow
[2025-11-11T16:50:02Z] [INFO] Found 2 eligible task(s)
[2025-11-11T16:50:02Z] [INFO] Delegating task 999001 with ADW ID abc12345
[2025-11-11T16:50:02Z] [INFO]   Model: sonnet
[2025-11-11T16:50:02Z] [INFO]   Worktree: proto-add-user-authentication
[2025-11-11T16:50:02Z] [INFO]   Workflow: plan-implement (vite_vue)
[2025-11-11T16:50:03Z] [INFO] Updating task 999001 to status: In progress
[2025-11-11T16:50:04Z] [INFO] Successfully updated task 999001 to In progress
[2025-11-11T16:50:04Z] [INFO] Successfully spawned workflow for task 999001
[2025-11-11T16:50:05Z] [INFO] Delegating task 999002 with ADW ID def67890
[2025-11-11T16:50:05Z] [INFO]   Model: sonnet
[2025-11-11T16:50:05Z] [INFO]   Worktree: feat-fix-bug-in-payment-flow
[2025-11-11T16:50:05Z] [INFO]   Workflow: build
[2025-11-11T16:50:06Z] [INFO] Updating task 999002 to status: In progress
[2025-11-11T16:50:07Z] [INFO] Successfully updated task 999002 to In progress
[2025-11-11T16:50:07Z] [INFO] Successfully spawned workflow for task 999002
[2025-11-11T16:50:07Z] [INFO] === Polling cycle complete: 2/2 tasks delegated ===
[2025-11-11T16:50:07Z] [INFO] Sleeping for 15s...

[2025-11-11T16:50:22Z] [INFO] --- Cycle 2 ---
[2025-11-11T16:50:22Z] [INFO] === Starting polling cycle ===
[2025-11-11T16:50:22Z] [INFO] Fetching tasks from Teamwork project 12345
[2025-11-11T16:50:24Z] [INFO] No eligible tasks found
[2025-11-11T16:50:24Z] [INFO] === Polling cycle complete: 0/0 tasks delegated ===
[2025-11-11T16:50:24Z] [INFO] Sleeping for 15s...

[2025-11-11T16:50:39Z] [INFO] --- Cycle 3 ---
^C
[2025-11-11T16:50:40Z] [INFO] Received SIGINT signal, shutting down gracefully...
```

## Summary

**When you run `bun run trigger:teamwork`, you get:**

✅ **Continuous monitoring** - Polls Teamwork every 15 seconds
✅ **Automatic task detection** - Finds tasks with "execute" trigger
✅ **Instant claiming** - Updates status to prevent duplicates
✅ **Parallel execution** - Spawns detached workflows
✅ **No rate limiting** - Bun.spawn() works perfectly
✅ **Graceful shutdown** - Ctrl+C stops cleanly
✅ **Error recovery** - Failed tasks marked as "Failed"

**It's a fire-and-forget system:**
- Monitor stays running
- Workflows execute independently
- You can Ctrl+C the monitor anytime
- Workflows keep running in background
