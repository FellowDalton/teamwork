# Teamwork Workflow Stages

## Overview

Teamwork workflows define the stages (columns) that tasks move through in a project. While the Teamwork API allows reading workflow stages, it **does not currently support programmatically moving tasks between stages** (as of November 2025).

## Current API Limitation

**What Works:**
- ✅ Reading workflows and their stages via API
- ✅ Detecting which tasks are in which stages
- ✅ Changing task status via completion endpoints (`/complete`, `/uncomplete`)

**What Doesn't Work:**
- ❌ Moving tasks between workflow stages programmatically
- ❌ Assigning tasks to workflow stages via API
- ❌ The `workflowStageId` field is not accepted by the API

## Workaround: Stage Directive Comments

Until Teamwork updates their workflow API, use **stage directive comments** to indicate that a task should be moved to a different workflow stage.

### Comment Format

```
WORKFLOW: Move to "{stage_name}" stage
```

### Example Workflow Stages

For the "Todo" workflow (ID: 9904) in project 805682:

| Stage ID | Stage Name | Display Order | Color |
|----------|------------|---------------|-------|
| 54900 | Ready | 1999.5 | #ff7641 |
| 54876 | In progress | 2000 | #ffc63c |
| 54884 | Review | 2001 | #ffc63c |
| 54885 | Done | 2002 | #4ecd97 |

### Adding Stage Directives

**Via API (v1):**
```bash
curl -X POST \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{"comment":{"body":"WORKFLOW: Move to \"In progress\" stage","notify":""}}' \
  'https://deliver.fellow.dk/projects/api/v1/tasks/{task_id}/comments.json'
```

**Via MCP Tool:**
```javascript
mcp__teamwork__twprojects-create_comment({
  object: { type: "tasks", id: task_id },
  body: 'WORKFLOW: Move to "In progress" stage',
  content_type: "TEXT"
})
```

## Integration with /update_teamwork_task

The `/update_teamwork_task` slash command now supports an optional `workflow_stage` parameter in the update_content JSON:

```json
{
  "status": "Done",
  "adw_id": "abc12345",
  "workflow_stage": "Review",
  "result": "Implementation complete, ready for review"
}
```

When `workflow_stage` is provided, the command will:
1. Update the task status as usual
2. Post a status update comment with metadata
3. **Append a workflow stage directive** to the comment

### Example Comment Output

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

## Detecting Current Workflow Stage

To check which stage a task is currently in:

```bash
curl -s -H 'Authorization: Bearer {token}' \
  'https://deliver.fellow.dk/projects/api/v3/workflows/{workflow_id}.json?include=stages,tasks' \
  | jq '.included.stages[] | select(.taskIds) | {id, name, taskIds}'
```

**Example Response:**
```json
{
  "id": 54900,
  "name": "Ready",
  "taskIds": [26737953, 26737954]
}
```

## Workflow Queries

### List All Workflows

```bash
curl -s -H 'Authorization: Bearer {token}' \
  'https://deliver.fellow.dk/projects/api/v3/workflows.json' \
  | jq '.workflows[] | {id, name, projectIds}'
```

### Get Workflow Stages

```bash
curl -s -H 'Authorization: Bearer {token}' \
  'https://deliver.fellow.dk/projects/api/v3/workflows/{workflow_id}.json?include=stages' \
  | jq '.included.stages[] | {id, name, displayOrder, color}'
```

### Find Project's Workflow

```bash
curl -s -H 'Authorization: Bearer {token}' \
  'https://deliver.fellow.dk/projects/api/v3/workflows.json' \
  | jq '.workflows[] | select(.projectIds[] == {project_id})'
```

## Manual Process

Until the API is updated, follow this process:

1. **Automation adds stage directive comment**
   ```
   WORKFLOW: Move to "Review" stage
   ```

2. **Human reviews tasks with "WORKFLOW:" comments**
   - Search for tasks with comments containing "WORKFLOW:"
   - Verify the task is ready to move

3. **Human moves task in Teamwork UI**
   - Drag task to the appropriate board column
   - Or update via task details panel

4. **Task moves to new stage**
   - Teamwork updates the workflow stage
   - Task appears in new column

## Future: Direct API Support

Teamwork has indicated they will update the workflow API soon. When available, we'll update the system to use:

```javascript
// Future API (not yet available)
mcp__teamwork__twprojects-update_task({
  id: task_id,
  workflowStageId: stage_id
})
```

## Testing Stage Comments

Test that stage directive comments work:

```bash
# Add comment with stage directive
curl -X POST \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{"comment":{"body":"WORKFLOW: Move to \"In progress\" stage","notify":""}}' \
  'https://deliver.fellow.dk/projects/api/v1/tasks/26737953/comments.json'

# Verify comment was added
curl -s -H 'Authorization: Bearer {token}' \
  'https://deliver.fellow.dk/projects/api/v3/tasks/26737953/comments.json' \
  | jq '.comments[] | {id, body}'
```

**Expected Output:**
```json
{
  "id": 9805744,
  "body": "WORKFLOW: Move to \"In progress\" stage"
}
```

## Related Files

- `/update_teamwork_task` - Slash command that supports workflow_stage parameter
- `TEAMWORK_MONITOR_FLOW.md` - How the task monitor works
- `TEAMWORK_STATUS_FIX.md` - Task status configuration guide
- `adws-bun/src/workflows/adw-plan-implement-update-teamwork-task.ts` - Main workflow script
- `adws-bun/src/workflows/adw-build-update-teamwork-task.ts` - Simple build workflow

## Summary

- **Current State**: Workflow stages are read-only via API
- **Workaround**: Use `WORKFLOW: Move to "{stage}" stage` comments
- **Integration**: `/update_teamwork_task` supports `workflow_stage` in update_content JSON
- **Future**: Direct API support expected soon from Teamwork
- **Manual Step**: Human must move tasks in Teamwork UI based on directive comments
