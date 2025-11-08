# Get Teamwork Tasks

Query tasks from a Teamwork project and prepare them for agent processing.

## Usage

```bash
/get_teamwork_tasks <project_id> [status_filter] [limit]
```

## Parameters

- `project_id` (required): Teamwork project ID to monitor
- `status_filter` (optional): JSON array of status names, default: `["New", "To Do"]`
- `limit` (optional): Max tasks to return, default: `10`

## Functionality

1. Query project tasks with status filter using MCP tools
2. Parse task description for execution triggers: `execute` or `continue - [prompt]`
3. Extract Teamwork native tags (e.g., "prototype:vite_vue")
4. Parse inline tags from description as fallback: `{{key: value}}`
5. Combine tag sources (native tags take precedence)
6. Build `task_prompt` field from description
7. Return JSON array of eligible tasks

## Tag Parsing Priority

1. **Teamwork native tags**: `["prototype:vite_vue", "model:sonnet"]` → `tags.prototype = "vite_vue"`, `tags.model = "sonnet"`
2. **Inline tags** (fallback): `{{worktree: feat-auth}}` → `tags.worktree = "feat-auth"` (only if not in native tags)

## Execution Trigger Detection

- If description ends with `execute` → `execution_trigger: "execute"`
- If contains `continue - <text>` → `execution_trigger: "continue"`, `task_prompt: "<text>"`
- Otherwise → skip task (not eligible)

## Response Format

```json
[
  {
    "task_id": "12345678",
    "title": "Build sentiment analysis UV script",
    "status": "New",
    "description": "Create a Python script that analyzes sentiment...\n\n{{prototype: uv_script}}\n\nexecute",
    "tags": {
      "prototype": "uv_script",
      "model": "sonnet",
      "worktree": "proto-sentiment"
    },
    "execution_trigger": "execute",
    "task_prompt": "Create a Python script that analyzes sentiment...",
    "assigned_to": null,
    "created_time": "2025-01-15T10:00:00Z",
    "due_date": null,
    "project_id": "12345"
  }
]
```

## Error Handling

- Invalid project_id: Return error message
- No eligible tasks: Return empty array `[]`
- API failures: Retry up to 3 times with exponential backoff
- Tag parsing errors: Log warning, continue without tags

## Implementation

**Step 1**: List tasks from project using MCP tool:
```
mcp__teamwork__twprojects-list_tasks_by_project(project_id, statusIDs filtered by status_filter)
```

**Step 2**: For each task, fetch full details:
```
mcp__teamwork__twprojects-get_task(task_id)
```

**Step 3**: Parse task data:
- Extract native tags and convert to key:value dict
- Parse inline tags from description using regex: `\{\{(\w+):\s*([^}]+)\}\}`
- Merge tags (native takes precedence)
- Detect execution trigger from description (last line/paragraph)
- Build clean task_prompt (remove tags and trigger)

**Step 4**: Filter and return only eligible tasks with execution triggers

## Example

```bash
/get_teamwork_tasks 12345 '["New", "To Do"]' 10
```

Returns tasks from project 12345 with status "New" or "To Do", up to 10 tasks.
