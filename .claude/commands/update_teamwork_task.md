# Update Teamwork Task

Update Teamwork task status and post agent updates as comments.

## Usage

```bash
/update_teamwork_task <task_id> <status> [update_content]
```

## Parameters

- `task_id` (required): Teamwork task ID
- `status` (required): New status value (system status, will be mapped to Teamwork status)
- `update_content` (optional): JSON string with update details

## Status Mapping

System statuses are mapped to Teamwork statuses:

| System Status | Teamwork Status (default) |
|---------------|---------------------------|
| Not started   | New / To Do               |
| In progress   | In Progress               |
| Done          | Complete / Done           |
| HIL Review    | Review / Waiting On       |
| Failed        | Blocked                   |

## Functionality

1. Parse `update_content` JSON
2. Map system status to Teamwork status
3. Update task status using `mcp__teamwork__twprojects-update_task`
4. Format update as comment with metadata
5. Post comment using `mcp__teamwork__twprojects-create_comment`
6. If commit_hash present, optionally add as tag: `commit:<hash>`

## Comment Format

Comments are formatted with emoji indicators and structured metadata:

```markdown
✅ **Status Update: Complete**
- **ADW ID**: `abc12345`
- **Timestamp**: 2025-01-15T14:45:00Z
- **Commit Hash**: `a1b2c3d4`
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

**Result**: Implementation completed successfully. Created apps/sentiment_analyzer/ with full functionality.
```

## Comment Emoji Map

- In Progress: 🔄
- Complete: ✅
- Failed: ❌
- Review: 👁️
- Blocked: 🚫

## Update Content Schema

```json
{
  "status": "Done",
  "adw_id": "abc12345",
  "commit_hash": "a1b2c3d4e",
  "timestamp": "2025-01-15T14:45:00Z",
  "model": "sonnet",
  "workflow": "plan-implement-update",
  "worktree_name": "proto-sentiment",
  "workflow_stage": "Review",
  "result": "Implementation completed successfully...",
  "error": ""
}
```

### Optional Fields

- **`workflow_stage`** (optional): Target workflow stage name (e.g., "Ready", "In progress", "Review", "Done")
  - When provided, appends a workflow stage directive to the comment
  - Format: `WORKFLOW: Move to "{stage_name}" stage`
  - See `TEAMWORK_WORKFLOW_STAGES.md` for details on the workaround

## Comment Examples

### Success Comment (with Workflow Stage)

```markdown
✅ **Status Update: Complete**
- **ADW ID**: `abc12345`
- **Commit Hash**: `a1b2c3d4`
- **Timestamp**: 2025-01-15T14:45:00Z
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

**Result**: Implementation completed successfully. Created apps/sentiment_analyzer/ with full functionality.

---

⚠️ **WORKFLOW: Move to "Review" stage**
```

### Success Comment (without Workflow Stage)

```markdown
✅ **Status Update: Complete**
- **ADW ID**: `abc12345`
- **Commit Hash**: `a1b2c3d4`
- **Timestamp**: 2025-01-15T14:45:00Z
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

**Result**: Implementation completed successfully. Created apps/sentiment_analyzer/ with full functionality.
```

### Failure Comment

```markdown
❌ **Status Update: Blocked**
- **ADW ID**: `abc12345`
- **Timestamp**: 2025-01-15T14:45:00Z
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

**Error**: Build failed: Type error in main.py line 42
```

### In Progress Comment

```markdown
🔄 **Status Update: In Progress**
- **ADW ID**: `abc12345`
- **Timestamp**: 2025-01-15T14:30:00Z
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

Task claimed by agent. Starting workflow execution...
```

## Implementation

**Step 1**: Parse update_content JSON (if provided)

**Step 2**: Map system status to Teamwork status:
- Query available statuses if needed
- Use default mapping or custom config

**Step 3**: Update task status:
```
mcp__teamwork__twprojects-update_task(task_id, status=teamwork_status)
```

**Step 4**: Format comment with metadata:
- Add emoji based on status
- Include ADW ID, timestamp, commit hash, etc.
- Add result or error message
- **If `workflow_stage` is provided**: Append workflow stage directive

**Step 4a**: Append workflow stage directive (if provided):
```markdown
---

⚠️ **WORKFLOW: Move to "{workflow_stage}" stage**
```

**Step 5**: Post comment to task:
```
mcp__teamwork__twprojects-create_comment(
  object={"type": "tasks", "id": task_id},
  body=formatted_comment,
  content_type="TEXT"
)
```

**Step 6**: (Optional) Add commit tag if present:
```
mcp__teamwork__twprojects-create_tag(name=f"commit:{commit_hash[:8]}")
mcp__teamwork__twprojects-update_task(task_id, tag_ids=[...existing, new_tag_id])
```

## Error Handling

- Invalid task_id: Return error message
- Status update fails: Retry up to 3 times
- Comment posting fails: Log error but don't fail entire operation
- Tag creation fails: Log warning, continue without tag

## Examples

### Basic Update

```bash
/update_teamwork_task 12345 "Done" '{"adw_id":"abc123","commit_hash":"a1b2c3d4","model":"sonnet","workflow":"plan-implement","result":"Success"}'
```

Updates task 12345 to "Complete" status and posts a success comment with metadata.

### Update with Workflow Stage Directive

```bash
/update_teamwork_task 12345 "Done" '{"adw_id":"abc123","commit_hash":"a1b2c3d4","model":"sonnet","workflow":"plan-implement","workflow_stage":"Review","result":"Implementation complete, ready for review"}'
```

Updates task 12345 to "Complete" status, posts a success comment, and includes a workflow stage directive asking to move the task to the "Review" stage.
