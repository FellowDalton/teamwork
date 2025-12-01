# Bun Teamwork Workflow - Comprehensive Test Scenarios

## Project Information
- **Project ID**: 805682 (AI workflow test)
- **Monitor Script**: `./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py`
- **Workflow Scripts**: 
  - Plan-Implement: `./adws/adw_plan_implement_update_teamwork_task.py`
  - Build: `./adws/adw_build_update_teamwork_task.py`

---

## Test Scenario 1: Simple Bun CLI Tool

### Purpose
Validate the complete workflow for a simple, single-file Bun TypeScript CLI utility. Tests basic prototype routing and plan generation.

### Task Configuration

**Task Title**: JSON Pretty Printer CLI

**Task Description**:
```
Create a simple Bun CLI tool that reads JSON from stdin or a file argument and outputs formatted, colorized JSON to stdout.

Requirements:
- Accept JSON input via stdin or file path argument
- Output pretty-printed JSON with syntax highlighting (colors for keys, values, etc.)
- Include --help flag showing usage
- Handle invalid JSON with clear error messages
- Single file implementation (index.ts)
- No external dependencies beyond Bun built-ins

Example usage:
echo '{"name":"test","value":123}' | bun run index.ts
bun run index.ts data.json
bun run index.ts --help

execute
```

**Native Tags to Apply in Teamwork**:
- `prototype:bun_scripts`
- `model:sonnet`

**Execution Trigger**: `execute` (at end of description)

**Expected Worktree**: `proto-json-pretty-printer-cli`

**Expected App Directory**: `apps/json_pretty_printer/`

**Expected Files Created**:
- `apps/json_pretty_printer/index.ts` - Main CLI implementation
- `apps/json_pretty_printer/package.json` - Bun project config
- `apps/json_pretty_printer/tsconfig.json` - TypeScript config
- `apps/json_pretty_printer/README.md` - Usage documentation
- `specs/plan-json_pretty_printer-bun-scripts.md` - Implementation plan

**Expected Plan Metadata**:
- task_type: `cli`
- complexity: `simple`
- app_name: `json_pretty_printer`

**Validation Commands**:
```bash
# Navigate to worktree
cd ../trees/proto-json-pretty-printer-cli/tac8_app4__agentic_prototyping

# Test the CLI
echo '{"name":"test","value":123}' | bun run apps/json_pretty_printer/index.ts
bun run apps/json_pretty_printer/index.ts apps/json_pretty_printer/package.json
bun run apps/json_pretty_printer/index.ts --help

# Verify git commit
git log -1 --oneline

# Check plan file
cat specs/plan-json_pretty_printer-bun-scripts.md
```

**Success Criteria**:
- Task status updated to "Done"
- Worktree created with correct name
- App directory created under `apps/`
- CLI tool runs successfully with all test cases
- Help output displays correctly
- Invalid JSON produces clear error message
- Commit hash posted to Teamwork task
- Plan file contains simple task structure

---

## Test Scenario 2: Medium Complexity Bun Service

### Purpose
Validate the workflow for a multi-file TypeScript project with dependencies, testing, and API integration. Tests medium complexity handling and proper project structure.

### Task Configuration

**Task Title**: GitHub Repo Stats API Client

**Task Description**:
```
Create a Bun TypeScript service that fetches and caches GitHub repository statistics.

Requirements:
- Multi-file TypeScript project structure (src/ directory)
- Main API client class with methods:
  - getRepoStats(owner, repo) - Get stars, forks, issues, watchers
  - getUserRepos(username) - List user's public repositories
  - searchRepos(query, limit) - Search repositories
- In-memory LRU cache with 5-minute TTL
- Rate limiting handler (GitHub API limits)
- Comprehensive error handling with typed errors
- CLI interface to demonstrate functionality
- Unit tests using Bun's built-in test runner
- Type definitions file
- JSDoc comments for public APIs

Project structure:
apps/github_stats/
├── src/
│   ├── client.ts       # Main API client
│   ├── cache.ts        # LRU cache implementation
│   ├── types.ts        # Type definitions
│   └── cli.ts          # CLI interface
├── tests/
│   ├── client.test.ts
│   └── cache.test.ts
├── index.ts            # Export entry point
├── package.json
├── tsconfig.json
└── README.md

execute
```

**Native Tags to Apply in Teamwork**:
- `prototype:bun_scripts`
- `model:sonnet`

**Execution Trigger**: `execute` (at end of description)

**Expected Worktree**: `proto-github-repo-stats-api-client`

**Expected App Directory**: `apps/github_stats/`

**Expected Files Created**:
- `apps/github_stats/src/client.ts`
- `apps/github_stats/src/cache.ts`
- `apps/github_stats/src/types.ts`
- `apps/github_stats/src/cli.ts`
- `apps/github_stats/tests/client.test.ts`
- `apps/github_stats/tests/cache.test.ts`
- `apps/github_stats/index.ts`
- `apps/github_stats/package.json`
- `apps/github_stats/tsconfig.json`
- `apps/github_stats/README.md`
- `specs/plan-github_stats-bun-scripts.md`

**Expected Plan Metadata**:
- task_type: `service`
- complexity: `medium`
- app_name: `github_stats`

**Validation Commands**:
```bash
# Navigate to worktree
cd ../trees/proto-github-repo-stats-api-client/tac8_app4__agentic_prototyping

# Install dependencies
cd apps/github_stats && bun install

# Run tests
bun test

# Test CLI interface
bun run src/cli.ts getRepoStats oven-sh bun
bun run src/cli.ts getUserRepos evanw
bun run src/cli.ts searchRepos "typescript runtime" 5

# Verify project structure
ls -la src/ tests/

# Check plan file phases
cd ../..
cat specs/plan-github_stats-bun-scripts.md | grep "Implementation Phases" -A 20
```

**Success Criteria**:
- Task status updated to "Done"
- Proper multi-file project structure
- All tests pass
- CLI interface works for all three commands
- Cache implementation verified
- Error handling tested
- Type definitions complete
- Plan includes Implementation Phases section
- Plan complexity marked as "medium"

---

## Test Scenario 3: Edge Case - Continuation from Review Status

### Purpose
Test the "continue" execution trigger to validate Human-in-the-Loop (HIL) review workflow. Tests agent's ability to pick up context and add features.

### Phase 1: Initial Task

**Task Title**: Simple File Hasher Tool

**Task Description**:
```
Create a Bun CLI tool that computes file hashes.

Requirements:
- Accept file path as argument
- Support MD5, SHA-1, SHA-256 algorithms
- Output hash in hex format
- Simple single-file implementation

execute
```

**Native Tags to Apply in Teamwork**:
- `prototype:bun_scripts`
- `model:sonnet`

**Expected Initial Outcomes**:
- Task completes and moves to "Done"
- Basic hasher created in `apps/file_hasher/index.ts`
- Worktree: `proto-simple-file-hasher-tool`

### Phase 2: Continuation Setup

**After Initial Completion**: Manually update task status to "Review" in Teamwork UI and update the task description.

**Updated Task Description**:
```
Create a Bun CLI tool that computes file hashes.

Requirements:
- Accept file path as argument
- Support MD5, SHA-1, SHA-256 algorithms
- Output hash in hex format
- Simple single-file implementation

continue - Add batch processing mode: accept directory path and hash all files recursively, output results as JSON with file paths and hashes. Include progress indicator for large directories. Add --format flag to choose between json or text output.
```

**Execution Trigger**: `continue - <prompt>` (in description)

**Expected Continuation Outcomes**:
- Monitor detects "Review" status with "continue" trigger
- Task claimed and updated to "In progress"
- Same worktree reused: `proto-simple-file-hasher-tool`
- `apps/file_hasher/index.ts` updated with new features

**Validation Commands**:
```bash
# Navigate to worktree
cd ../trees/proto-simple-file-hasher-tool/tac8_app4__agentic_prototyping

# Test original functionality
bun run apps/file_hasher/index.ts package.json

# Test new batch mode
mkdir -p test_dir
echo "test" > test_dir/file1.txt
echo "data" > test_dir/file2.txt
bun run apps/file_hasher/index.ts test_dir/ --format json
bun run apps/file_hasher/index.ts test_dir/ --format text

# Check git history shows two commits
git log --oneline | head -5

# Verify continuation was processed
cat specs/plan-*.md | grep -i "continue\|continuation" || echo "Check plan mentions continuation"
```

**Success Criteria**:
- Monitor detects "continue" trigger in "Review" status
- Task claimed and updated to "In progress"
- Agent receives continuation prompt
- Original functionality preserved
- New batch mode implemented
- Progress indicator shown for large directories
- Format flag works correctly
- Second commit created
- Task updated back to "Done"
- Worktree reused (not recreated)

---

## Test Scenario 4: Build Workflow Fallback (No Prototype Tag)

### Purpose
Validate routing logic: tasks without `prototype:bun_scripts` tag should use the simpler build workflow instead of plan-implement workflow.

### Task Configuration

**Task Title**: Add Utility Function to ADW Modules

**Task Description**:
```
Add a new utility function sanitize_filename() to adws/adw_modules/utils.py.

Requirements:
- Function should take a string and return a filesystem-safe filename
- Remove or replace special characters: / \ : * ? " < > |
- Replace spaces with underscores
- Limit length to 255 characters
- Handle empty strings and None input
- Add docstring with examples
- Add simple test demonstration in docstring

execute
```

**Native Tags to Apply in Teamwork**:
- `model:sonnet`
- **NO** `prototype:bun_scripts` tag (this is the key test!)

**Execution Trigger**: `execute` (at end of description)

**Expected Workflow**: Build workflow (`adw_build_update_teamwork_task.py`)

**Expected Worktree**: `feat-add-utility-function-to-adw-modules`

**Expected Modifications**:
- `adws/adw_modules/utils.py` updated with new function
- **NO** `specs/plan-*.md` file created (build workflow skips planning)
- **NO** `apps/` directory created (this isn't a prototype)

**Validation Commands**:
```bash
# Navigate to worktree
cd ../trees/feat-add-utility-function-to-adw-modules/tac8_app4__agentic_prototyping

# Check the function was added
grep -A 10 "def sanitize_filename" adws/adw_modules/utils.py

# Test the function
python3 -c "
import sys
sys.path.insert(0, 'adws/adw_modules')
from utils import sanitize_filename
print(sanitize_filename('my/file*name?.txt'))
print(sanitize_filename('  spaces  and  stuff  '))
"

# Verify NO plan file was created
ls -la specs/ | grep plan- && echo "ERROR: Plan file created" || echo "✓ No plan file (expected)"

# Verify NO apps directory changes
git diff --name-only | grep "^apps/" && echo "ERROR: Unexpected apps/ changes" || echo "✓ No apps/ changes"

# Check commit message
git log -1 --pretty=format:"%s"
```

**Success Criteria**:
- Task routed to build workflow (NOT plan-implement)
- Worktree name uses "feat-" prefix (not "proto-")
- Function added to utils.py correctly
- Function handles all edge cases
- Docstring includes examples
- NO plan file in specs/
- NO changes to apps/ directory
- Task updated to "Done"
- Task metadata shows "workflow": "build-update"

---

## Test Execution Instructions

### Prerequisites
```bash
# Ensure environment is configured
cd /Users/dalton/projects/teamwork
source .env  # Contains TEAMWORK_PROJECT_ID=805682

# Verify Teamwork MCP integration
cat .mcp.json | grep -A 5 teamwork

# Check monitor script works
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --help
```

### Running Tests

**Option 1: Use Monitor (Automated) - RECOMMENDED**
```bash
# Start monitor in once mode to process one batch
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once

# Or use dry-run mode to see what would happen
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once --dry-run

# Monitor logs will show:
# - Tasks fetched from Teamwork
# - Routing decisions (build vs plan-implement)
# - Workflow spawns
# - ADW IDs generated
```

**Option 2: Manual Task Creation in Teamwork UI**
1. Navigate to Teamwork project 805682
2. Create new task with exact title and description from scenario
3. Apply native tags using Teamwork's tag interface:
   - Click "Add Tag" button
   - Type tag exactly as shown (e.g., `prototype:bun_scripts`)
   - Apply tag
4. Ensure status is "New" or "To Do"
5. Save task
6. Run monitor: `./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once`

**Option 3: Manual Workflow Invocation (Debug Mode)**
```bash
# Generate test ADW ID
ADW_ID=$(python3 -c "import uuid; print(str(uuid.uuid4())[:8])")
echo "Test ADW ID: $ADW_ID"

# Test Scenario 1 directly (plan-implement with prototype)
./adws/adw_plan_implement_update_teamwork_task.py \
  "$ADW_ID" \
  "TASK_ID_FROM_TEAMWORK" \
  "Create a simple JSON pretty printer..." \
  "proto-json-pretty-printer-cli" \
  "bun_scripts" \
  "sonnet" \
  "805682"

# Test Scenario 4 directly (build workflow)
./adws/adw_build_update_teamwork_task.py \
  "$ADW_ID" \
  "TASK_ID_FROM_TEAMWORK" \
  "Add utility function..." \
  "feat-add-utility" \
  "sonnet" \
  "805682"
```

### Monitoring Progress

```bash
# Watch for new worktrees
watch -n 5 'git worktree list'

# Check agent outputs
ls -la agents/  # Shows ADW IDs
# View specific agent output
cat agents/<adw_id>/*/cc_raw_output.json | jq .

# Check Teamwork task status via MCP
claude /get_teamwork_tasks 805682 '["In Progress", "Done", "Failed"]' 10

# View specific task
claude /get_teamwork_task TASK_ID_HERE
```

### Cleanup After Tests

```bash
# List all test worktrees
git worktree list | grep -E "(proto-|feat-)"

# Remove test worktrees one by one
git worktree remove ../trees/proto-json-pretty-printer-cli --force
git worktree remove ../trees/proto-github-repo-stats-api-client --force
git worktree remove ../trees/proto-simple-file-hasher-tool --force
git worktree remove ../trees/feat-add-utility-function-to-adw-modules --force

# Prune stale references
git worktree prune

# Clean up branches if needed
git branch -d proto-json-pretty-printer-cli
git branch -d proto-github-repo-stats-api-client
git branch -d proto-simple-file-hasher-tool
git branch -d feat-add-utility-function-to-adw-modules

# Inspect test apps before removing (optional)
ls -la apps/json_pretty_printer/
ls -la apps/github_stats/
ls -la apps/file_hasher/
```

---

## Expected Results Summary

| Scenario | Workflow | Worktree Prefix | Creates Plan | Creates App | Final Status |
|----------|----------|-----------------|--------------|-------------|--------------|
| 1. Simple CLI | plan-implement | proto- | Yes | Yes (apps/json_pretty_printer) | Done |
| 2. Medium Service | plan-implement | proto- | Yes | Yes (apps/github_stats) | Done |
| 3. Continuation | plan-implement | proto- | Yes (updated) | Yes (modified) | Done |
| 4. Build Fallback | build | feat- | No | No | Done |

---

## Validation Checklist

After running all scenarios, verify:

### Core Functionality
- [ ] All four tasks completed successfully
- [ ] Task statuses updated to "Done" in Teamwork
- [ ] Correct workflow routing (check monitor logs)
- [ ] Worktree names match expected patterns
- [ ] All validation commands passed

### Plan-Implement Workflow (Scenarios 1-3)
- [ ] Plan files created in specs/ directory
- [ ] Plan files contain correct metadata (adw_id, complexity, task_type)
- [ ] Apps created in correct directories
- [ ] Generated code runs successfully
- [ ] Commit hashes posted to Teamwork

### Build Workflow (Scenario 4)
- [ ] NO plan file created
- [ ] Changes made to existing files only
- [ ] NO prototype app directory created
- [ ] Task metadata shows "workflow": "build-update"

### Continuation Workflow (Scenario 3)
- [ ] Phase 1 completed successfully
- [ ] Phase 2 detected "continue" trigger
- [ ] Same worktree reused
- [ ] Original functionality preserved
- [ ] New features added correctly

### System Health
- [ ] No orphaned processes: `ps aux | grep adw_`
- [ ] Git worktrees in clean state
- [ ] No error messages in monitor logs
- [ ] All agent outputs have success status

---

## Troubleshooting Guide

### Task Not Being Picked Up by Monitor

**Symptoms**: Task stays in "New" status, monitor doesn't process it

**Checks**:
1. Verify task status is exactly "New" (case-insensitive)
2. Confirm "execute" or "continue - " is at end of description
3. Check project ID matches: should be 805682
4. Verify tags are applied correctly (check task JSON)
5. Run monitor with verbose logging:
   ```bash
   ./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once --dry-run
   ```

**Solutions**:
- Re-save task in Teamwork UI
- Check `.env` has correct `TEAMWORK_PROJECT_ID`
- Verify MCP Teamwork server is configured in `.mcp.json`
- Test MCP connection: `claude /get_teamwork_tasks 805682 '["New"]' 5`

### Workflow Failed Mid-Execution

**Symptoms**: Task status stuck in "In progress", no completion update

**Checks**:
1. Find ADW ID from task description in Teamwork
2. Check agent outputs:
   ```bash
   ls -la agents/<adw_id>/
   cat agents/<adw_id>/*/cc_raw_output.json
   ```
3. Review prompts sent:
   ```bash
   cat agents/<adw_id>/*/prompts/*.txt
   ```
4. Check worktree status:
   ```bash
   cd ../trees/<worktree-name>/tac8_app4__agentic_prototyping
   git status
   git log -1
   ```

**Solutions**:
- Check Claude API quota/rate limits
- Verify `ANTHROPIC_API_KEY` in `.env`
- Increase timeout if planning phase is slow
- Check for syntax errors in generated plan

### Wrong Workflow Chosen (Build vs Plan-Implement)

**Symptoms**: Simple task gets plan-implement, or prototype gets build

**Checks**:
1. Verify tag parsing:
   ```bash
   claude /get_teamwork_task TASK_ID
   ```
2. Check routing logic in monitor logs
3. Review tags applied to task in Teamwork UI

**Expected Routing**:
- Has `prototype:bun_scripts` → Plan-Implement workflow
- Has `workflow:plan` tag → Plan-Implement workflow
- Task description >500 chars → Plan-Implement workflow
- None of above → Build workflow

**Solutions**:
- Ensure tags use exact format: `prototype:bun_scripts` (colon, no spaces)
- Check tag is applied as native tag, not just in description
- Verify `should_use_full_workflow()` logic in data_models.py

### Continuation Not Working

**Symptoms**: Task with "continue -" doesn't get picked up from "Review" status

**Checks**:
1. Verify task status is exactly "Review"
2. Check status_filter includes "Review":
   ```python
   # In data_models.py TeamworkCronConfig
   status_filter: List[str] = ["New", "Review"]
   ```
3. Verify description contains "continue - " (note space after dash)
4. Check execution_trigger parsing:
   ```bash
   # Should extract "continue" as execution_trigger
   cat agents/<adw_id>/*/prompts/*.txt | grep -i continue
   ```

**Solutions**:
- Update task status to exactly "Review" (check capitalization)
- Ensure "continue - " has space after dash
- Add any missing context from previous execution
- Check worktree still exists from original task

### Worktree Creation Failed

**Symptoms**: Workflow fails immediately, can't create worktree

**Checks**:
1. Check if worktree already exists:
   ```bash
   git worktree list | grep <worktree-name>
   ```
2. Verify working directory is clean:
   ```bash
   git status
   ```
3. Check disk space:
   ```bash
   df -h .
   ```

**Solutions**:
- Remove stale worktree: `git worktree remove ../trees/<name> --force`
- Prune references: `git worktree prune`
- Commit or stash changes in main worktree
- Use custom worktree name with `worktree:custom-name` tag

---

## Performance Expectations

### Scenario 1: Simple CLI Tool
- Planning phase: 2-4 minutes
- Implementation: 3-5 minutes
- Total: 5-9 minutes

### Scenario 2: Medium Service
- Planning phase: 4-6 minutes
- Implementation: 8-12 minutes
- Total: 12-18 minutes

### Scenario 3: Continuation
- Phase 1: 5-9 minutes (like Scenario 1)
- Phase 2: 4-7 minutes (incremental changes)
- Total: 9-16 minutes (both phases)

### Scenario 4: Build Fallback
- Build phase: 2-4 minutes
- Total: 2-4 minutes (no planning phase)

These are estimates for Claude Sonnet. Opus would be slower but may handle complex scenarios better.

---

## Next Steps After Testing

1. **Review Generated Code**
   - Check code quality and correctness
   - Verify generated apps actually work
   - Review plan accuracy

2. **Document Issues**
   - Note any failures or unexpected behavior
   - Capture error messages and logs
   - Identify workflow improvements

3. **Iterate on Workflows**
   - Adjust routing logic if needed
   - Refine plan templates
   - Improve error handling

4. **Scale Testing**
   - Run multiple tasks in parallel
   - Test monitor continuous mode
   - Verify no resource leaks

---

## Success Metrics

- **Completion Rate**: All 4 scenarios should complete successfully
- **Routing Accuracy**: 100% correct workflow selection
- **Code Quality**: Generated apps should run without errors
- **Plan Quality**: Plans should be detailed and accurate
- **Continuation**: Phase 2 should preserve Phase 1 work
- **Error Handling**: Failed tasks should update status appropriately
