# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TAC8 App4 is a **multi-agent rapid prototyping system** that monitors task management platforms (Notion or Teamwork) for prototype requests and automatically generates complete applications using AI agents. The system uses isolated git worktrees for parallel development and specialized planning agents for different technology stacks (Vue.js, Python UV scripts, Bun TypeScript, MCP servers).

**Note:** The system has been migrated from Python to TypeScript/Bun. All workflows are now in `adws-bun/` with 90.57% test coverage and native subprocess execution (no rate limiting issues).

### Key Concepts

- **Task Management Integration**: Tasks can be defined in either Notion or Teamwork with status tracking, execution triggers, and tags
- **Worktree Isolation**: Each task gets its own git worktree with sparse checkout for parallel development
- **Multi-Agent Workflows**: Tasks are routed to different workflows (build, plan-implement, prototypes) based on tags
- **Specialized Planners**: Framework-specific `/plan_[prototype]` commands generate comprehensive implementation plans
- **Detached Execution**: Agents run as detached subprocesses for true parallelism and resilience

## Development Commands

### Running the System

**Teamwork Monitor** (recommended):
```bash
cd adws-bun

# Start the Teamwork task monitor (polls every 15 seconds)
bun run trigger:teamwork

# Run once and exit (no continuous monitoring)
bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts --once

# Dry run mode (no changes, just logging)
bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts --dry-run

# Custom polling interval (in seconds)
bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts --interval 30

# Limit concurrent tasks
bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts --max-tasks 5
```

**Notion Monitor**:
```bash
cd adws-bun

# Start the Notion task monitor (polls every 15 seconds)
bun run trigger:notion

# Same flags as Teamwork monitor: --once, --dry-run, --interval, --max-tasks
```

### Testing Workflows

**Teamwork workflows**:
```bash
cd adws-bun

# Test individual workflows manually
bun run build-workflow <adw_id> <task_id> <task_description> <worktree_name>
bun run plan-workflow <adw_id> <task_id> <task_description> <worktree_name> <prototype>

# Test slash commands
claude /get_teamwork_tasks <project_id> '["New"]' 5
claude /update_teamwork_task <task_id> "Done" '{"adw_id":"test123"}'
```

**Notion workflows**:
```bash
cd adws-bun

# Test Notion workflows
bun run src/workflows/adw-build-update-notion-task.ts <adw_id> <page_id> <task_description> <worktree_name>
bun run src/workflows/adw-plan-implement-update-notion-task.ts <adw_id> <page_id> <task_description> <worktree_name>
```

**Test slash commands in a worktree**:
```bash
cd trees/your-worktree/tac8_app4__agentic_prototyping
claude /plan_vite_vue <adw_id> "Your prototype description"
claude /implement <adw_id> specs/plan-your-app.md
```

### Worktree Management

```bash
# List all worktrees
git worktree list

# Remove completed worktree
git worktree remove trees/feature-name

# Prune stale worktrees
git worktree prune

# Manual worktree creation (usually automated)
claude /init_worktree feature-name tac8_app4__agentic_prototyping
```

### Testing Generated Applications

```bash
# UV Python scripts
cd apps/your-app && uv run ./main.py --help

# Vite Vue applications
cd apps/your-app && bun install && bun run dev

# Bun TypeScript applications
cd apps/your-app && bun run index.ts

# MCP servers
cd apps/your-app && uv run mcp-server
```

## Architecture

### Directory Structure

```
tac8_app4__agentic_prototyping/
├── adws-bun/                      # AI Developer Workflows (Bun/TypeScript)
│   ├── src/
│   │   ├── modules/              # Core shared modules
│   │   │   ├── agent.ts         # Agent execution framework (TypeScript)
│   │   │   ├── data-models.ts   # Zod schemas and type definitions
│   │   │   └── utils.ts         # Utility functions
│   │   ├── workflows/           # Task execution workflows
│   │   │   ├── adw-build-update-teamwork-task.ts
│   │   │   └── adw-plan-implement-update-teamwork-task.ts
│   │   ├── triggers/            # Task monitoring daemons
│   │   │   ├── adw-trigger-cron-teamwork-tasks.ts
│   │   │   └── adw-trigger-cron-notion-tasks.ts
│   │   └── cli/                 # CLI tools
│   ├── tests/                   # Test suite (197 tests, 90.57% coverage)
│   └── agents/                  # Agent execution logs and outputs
├── .claude/commands/             # Slash command definitions (markdown files)
├── apps/                         # Generated prototype applications
├── specs/                        # Generated implementation plans
├── trees/                        # Git worktrees (isolated dev environments)
└── archive/                      # Archived Python code (reference only)
```

### Core Data Flow

1. **Trigger**: `adw-trigger-cron-teamwork-tasks.ts` polls Teamwork every 15 seconds
2. **Detection**: Identifies tasks with status "New" or "Review" + eligible tags
3. **Claiming**: Updates status to "In progress" with ADW ID to prevent duplicate work
4. **Routing**: Routes to workflow based on `prototype:type` or `workflow:plan` tags
5. **Execution**: Spawns detached Bun subprocess running workflow script
6. **Worktree**: Creates isolated worktree with sparse checkout of `tac8_app4__agentic_prototyping/`
7. **Planning**: Specialized `/plan_[prototype]` command generates implementation plan
8. **Implementation**: `/implement` executes the plan and creates the application
9. **Update**: `/update_teamwork_task` posts results, commit hash, or errors back to Teamwork

### Workflow Types

**Build Workflow** (`adw_build_update_notion_task.py`)
- Triggered by: Simple tasks without special tags
- Commands: `/build` → `/update_notion_task`
- Use case: Small changes, bug fixes, adding utilities

**Plan-Implement Workflow** (`adw_plan_implement_update_notion_task.py`)
- Triggered by: `{{workflow: plan}}` tag or complex tasks (>500 chars)
- Commands: `/plan` → `/implement` → `/update_notion_task`
- Use case: Complex features requiring architectural planning

**Prototype Workflow** (`adw_plan_implement_update_notion_task.py`)
- Triggered by: `{{prototype: type}}` tags (uv_script, vite_vue, bun_scripts, uv_mcp)
- Commands: `/plan_[prototype]` → `/implement` → `/update_notion_task`
- Use case: Generating complete applications from scratch

### Key Modules (TypeScript/Bun)

**`adws-bun/src/modules/agent.ts`**
- `executeTemplate(request)`: Execute slash commands with arguments
- `promptClaudeCode(request)`: Low-level Claude Code CLI invocation using Bun.spawn()
- `promptClaudeCodeWithRetry(request)`: Retry logic for transient errors
- `generateShortId()`: Generate 8-char UUID for ADW tracking
- `getSafeSubprocessEnv()`: Filter environment variables for secure subprocess execution

**`adws-bun/src/modules/data-models.ts`**
- Zod schemas for type-safe validation
- `TeamworkTask`: Parsed Teamwork task with tags, status, execution_trigger
- `TeamworkTaskUpdate`: Update payload for posting results back to Teamwork
- `AgentTemplateRequest`: Request for executing a slash command
- `WorktreeCreationRequest`: Request for automatic worktree creation

**`adws-bun/src/modules/utils.ts`**
- `parseJson()`: Safe JSON parsing with Zod type validation
- `setupLogger()`: Async logger setup with file and console output
- Various utility functions for string manipulation, file operations

## Important Patterns

### Task Tags

**Teamwork** tasks support both native tags and inline tags:

**Native Tags** (preferred, applied in Teamwork UI):
```
prototype:vite_vue    # Generate a Vue.js application
prototype:uv_script   # Generate Python UV script
prototype:bun_scripts # Generate Bun TypeScript app
prototype:uv_mcp      # Generate MCP server
model:sonnet          # Use Claude Sonnet (default, recommended)
model:opus            # Use Claude Opus (for complex tasks only)
workflow:plan         # Force plan-implement workflow
worktree:feat-auth    # Custom worktree name
app:my-app            # Custom app directory name
```

**Inline Tags** (backward compatible, in task description):
```markdown
{{model: sonnet}}        # Use Claude Sonnet (default, recommended)
{{model: opus}}          # Use Claude Opus (for complex tasks only)
{{workflow: plan}}       # Force plan-implement workflow
{{worktree: feat-auth}}  # Custom worktree name
{{app: my-app}}          # Custom app directory name
{{prototype: vite_vue}}  # Generate a Vue.js application
```

**Notion** tasks use inline tags only (see above format).

### Execution Triggers

Tasks must have one of these triggers in their description to be processed:
- `execute`: Start fresh execution (at end of description)
- `continue - <prompt>`: Pick up from "HIL Review"/"Review" status with new instructions

### Prototype Types

- **`uv_script`**: Python CLI tools with UV inline dependencies (single-file executables)
- **`vite_vue`**: Vue 3 + TypeScript + Vite web applications
- **`bun_scripts`**: TypeScript backend services with Bun runtime
- **`uv_mcp`**: Model Context Protocol servers for Claude integrations

### ADW ID Tracking

Every workflow execution gets a unique 8-character ADW ID used for:
- Tracking task ownership in Notion (prevents duplicate processing)
- Creating output directories: `agents/{adw_id}/{agent_name}/`
- Logging prompts: `agents/{adw_id}/{agent_name}/prompts/{command}.txt`
- Storing outputs: `agents/{adw_id}/{agent_name}/cc_raw_output.jsonl`

### Worktree Naming

Worktrees are created in `../trees/{worktree-name}/` with:
- Branch: `{worktree-name}` (e.g., `feat-user-auth`)
- Sparse checkout: Only `tac8_app4__agentic_prototyping/` directory
- Each worktree has its own `.mcp.json` if needed

### Agent Execution Lifecycle

```python
# 1. Generate ADW ID
adw_id = generate_short_id()

# 2. Claim task in Notion
update_task_status(page_id, "In progress", json.dumps({"adw_id": adw_id}))

# 3. Create worktree
worktree_name = make_worktree_name(task_description)
init_worktree(worktree_name, "tac8_app4__agentic_prototyping")

# 4. Spawn detached workflow subprocess
subprocess.Popen(
    ["./adws/adw_plan_implement_update_notion_task.py", adw_id, page_id, task_prompt, worktree_name],
    start_new_session=True  # Detach from parent
)

# 5. Workflow executes slash commands in sequence
execute_template(AgentTemplateRequest(
    slash_command="/plan_vite_vue",
    args=[adw_id, task_prompt],
    adw_id=adw_id,
    working_dir=worktree_path
))

# 6. Update Notion with results
execute_template(AgentTemplateRequest(
    slash_command="/update_notion_task",
    args=[page_id, "Done", json.dumps({"commit": commit_hash})],
    adw_id=adw_id
))
```

## Common Development Scenarios

### Adding a New Prototype Type

1. Create planning command in `.claude/commands/plan_[prototype].md`
2. Add prototype detection logic in `adw_trigger_cron_notion_tasks.py`
3. Update `data_models.py` to include new prototype type in validation
4. Test with a Notion task using `{{prototype: [prototype]}}`

### Adding a New Slash Command

1. Create `.claude/commands/[command].md` with description and usage
2. If command needs Python logic, add handler in appropriate ADW script
3. Test command directly: `claude /[command] <args>`

### Debugging Failed Tasks

```bash
# 1. Find the ADW ID from Notion task (in "In progress" status details)
adw_id="abc12345"

# 2. Check agent logs
ls -la agents/$adw_id/
cat agents/$adw_id/*/cc_raw_output.json

# 3. Check prompts sent
cat agents/$adw_id/*/prompts/*.txt

# 4. Check worktree status
cd trees/[worktree-name]/tac8_app4__agentic_prototyping
git status
git log -1

# 5. Review generated plan (if applicable)
cat specs/plan-*.md
```

### Testing Changes to Workflows

```bash
# Method 1: Use --once flag to process a single batch
./adws/adw_triggers/adw_trigger_cron_notion_tasks.py --once

# Method 2: Manually invoke workflow
./adws/adw_build_update_notion_task.py test123 fake-page-id "Test task" test-worktree

# Method 3: Test slash commands in isolation
cd trees/test-worktree/tac8_app4__agentic_prototyping
claude /build "Add a test utility function" .
```

### Handling HIL (Human-in-the-Loop) Reviews

When a task completes, you can review the output and add feedback:
1. Check the generated code in `apps/` or the worktree
2. Set Notion status to "HIL Review"
3. Add continuation instructions in task content: `continue - Add error handling and tests`
4. Monitor will pick it up on next poll and execute with the additional context

## Environment Setup

### Required Environment Variables (.env)

```bash
# Anthropic API key (required)
ANTHROPIC_API_KEY=sk-ant-...

# Teamwork project ID for task tracking (required for Teamwork)
TEAMWORK_PROJECT_ID=12345

# Teamwork polling configuration (optional)
TEAMWORK_POLLING_INTERVAL=15
TEAMWORK_MAX_CONCURRENT_TASKS=3

# Notion integration secret (required for Notion, legacy)
NOTION_INTERNAL_INTEGRATION_SECRET=secret_...

# Notion database ID for task tracking (required for Notion, legacy)
NOTION_AGENTIC_TASK_TABLE_ID=your-database-id

# Claude Code CLI path (optional, defaults to "claude")
CLAUDE_CODE_PATH=/path/to/claude
```

**Note**: Teamwork MCP configuration (bearer token, API URL) is in `.mcp.json`.

### System Dependencies

```bash
# Python with UV (required for running ADW scripts)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Bun (required for vite_vue and bun_scripts prototypes)
curl -fsSL https://bun.sh/install | bash

# Claude Code CLI (required)
# Follow installation instructions at https://claude.com/code
```

### MCP Configuration

The system uses MCP (Model Context Protocol) servers for Notion access. Configuration is in `.mcp.json`:
- Notion MCP server for reading/writing tasks
- Other MCP servers as needed for specific prototypes

## Security Considerations

### Environment Variable Filtering

The `get_safe_subprocess_env()` function in `agent.py` filters environment variables before spawning subprocesses. Only these are passed:
- `ANTHROPIC_API_KEY`
- `CLAUDE_CODE_PATH`
- Essential system vars: `HOME`, `USER`, `PATH`, `SHELL`, `TERM`
- Python vars: `PYTHONPATH`, `PYTHONUNBUFFERED`
- Working directory: `PWD`

**DO NOT** pass sensitive variables like `NOTION_INTERNAL_INTEGRATION_SECRET` to subprocesses unless explicitly required by MCP configuration.

### Subprocess Execution

Always use `start_new_session=True` when spawning workflow subprocesses:
```python
subprocess.Popen(cmd, start_new_session=True)
```

This ensures:
- Detachment from parent process
- Survival if monitor restarts
- Proper signal isolation

### Bun Native Subprocess Execution

The Bun/TypeScript implementation uses `Bun.spawn()` for native subprocess execution:

```typescript
// Direct execution - no wrappers needed
const proc = Bun.spawn({
  cmd: [CLAUDE_PATH, '-p', prompt],
  env: getSafeSubprocessEnv(),
  stdout: 'pipe',
  stderr: 'pipe',
  stdin: 'ignore',
});
```

**Why this works:** Bun's native spawn API doesn't trigger Claude Code's rate limiter. No bash wrapper or workarounds needed - `Bun.spawn()` is treated as direct process creation, just like running from bash.

**Benefits:**
- No rate limiting issues
- Simpler code - no intermediary scripts
- Faster execution - direct process spawning
- Better error handling - native TypeScript types

### Worktree Sparse Checkout

Worktrees use sparse checkout to include only `tac8_app4__agentic_prototyping/`:
- Reduces disk usage
- Isolates prototype work from main repo
- Prevents accidental modifications to other projects

## Troubleshooting

### Task Not Being Picked Up

1. Check status is "Not started" or "HIL Review"
2. Verify execution trigger is present: `execute` or `continue - ...`
3. Confirm `NOTION_AGENTIC_TASK_TABLE_ID` is correct
4. Check monitor is running: `ps aux | grep adw_trigger_cron_notion_tasks`
5. Review monitor output for errors

### Worktree Creation Fails

1. Ensure working directory is clean: `git status`
2. Check worktree doesn't already exist: `git worktree list`
3. Verify sufficient disk space
4. Confirm you're in project root (not inside `adws/`)

### Agent Execution Hangs

1. Check for `--dangerously-skip-permissions` flag (required for non-interactive execution)
2. Verify Claude Code CLI is accessible: `claude --version`
3. Check API key is valid: `echo $ANTHROPIC_API_KEY`
4. Review agent output logs: `cat agents/{adw_id}/*/cc_raw_output.json`

### Notion Updates Not Working

1. Verify MCP Notion server is running
2. Check `.mcp.json` configuration exists
3. Test manually: `claude /get_notion_tasks <db_id> '["Not started"]' 5`
4. Review MCP server logs for connection errors

### "Too many requests from this subprocess" Error

**This issue is solved in the Bun/TypeScript version!** The Python implementation had subprocess rate limiting issues, but Bun's native `spawn()` API doesn't trigger the rate limiter.

If you encounter this error:

1. **Migrate to Bun:** The issue doesn't exist in `adws-bun/` - `Bun.spawn()` works perfectly
2. **Verify using Bun:** Check that you're running from `adws-bun/` directory
3. **Check logs:** Review `adws-bun/agents/{adw_id}/*/cc_raw_output.json`

**Why Bun works:** Bun's native subprocess spawning is treated like direct execution - no detection or rate limiting.

See `docs/PYTHON_TO_BUN_MIGRATION_PLAN.md` for complete migration details.
