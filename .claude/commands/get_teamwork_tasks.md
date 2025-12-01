# Get Teamwork Tasks

Query tasks from a Teamwork project and prepare them for agent processing.

## Usage

```bash
/get_teamwork_tasks <project_id> [status_filter] [limit]
```

## Parameters

- `project_id` (required): Teamwork project ID to monitor
- `status_filter` (optional): JSON array of status names (lowercase), default: `["new", "to do"]`
- `limit` (optional): Max tasks to return, default: `10`

## Functionality

1. Query project tasks using MCP tools (status in Teamwork API is lowercase: "new", "to do", "review", etc.)
2. Filter tasks by status names (case-insensitive matching against the `status` field)
3. Parse task description for execution triggers: `execute` or `continue - [prompt]`
4. Extract Teamwork native tags (e.g., "prototype:vite_vue")
5. Parse inline tags from description as fallback: `{{key: value}}`
6. Combine tag sources (native tags take precedence)
7. Build `task_prompt` field from description
8. Return JSON array of eligible tasks

## Important Notes

- **Status Field**: Teamwork API returns status as lowercase strings (e.g., "new", "to do", "in progress", "review")
- **Board Columns**: Teamwork UI has board columns/stages (Backlog, New, Todo, In Progress, Review) but these are NOT separate from the status field in the API
- **All tasks with status "new"**: Tasks in both "Backlog" and "New" UI columns have `status: "new"` in the API
- **No Status IDs**: The MCP API does not use status IDs - filtering must be done on the status string after fetching tasks

## CRITICAL OUTPUT REQUIREMENT

**IMPORTANT**: You MUST return ONLY the JSON array with NO explanations, NO commentary, and NO markdown code blocks.

**CORRECT**:
```
[{"task_id": "123", "title": "Task", ...}]
```

**INCORRECT** (will break automated parsing):
```
Here are the tasks I found:
[{"task_id": "123", "title": "Task", ...}]
```

**INCORRECT** (will break automated parsing):
```json
[{"task_id": "123", "title": "Task", ...}]
```

Return ONLY the raw JSON array, nothing else.

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

**Step 1**: List ALL tasks from project using MCP tool (no status filtering in MCP call):
```
mcp__teamwork__twprojects-list_tasks_by_project(project_id)
```

**Step 2**: Filter tasks by status names:
- Convert status_filter array to lowercase: `["new", "to do"]`
- Keep tasks where `task.status.toLowerCase()` matches any status in the filter
- This handles case-insensitive matching

**Step 3**: For each matching task, fetch full details:
```
mcp__teamwork__twprojects-get_task(task_id)
```

**Step 4**: Parse task data:
- Extract native tags and convert to key:value dict
- Parse inline tags from description using regex: `\{\{(\w+):\s*([^}]+)\}\}`
- Merge tags (native takes precedence)
- Detect execution trigger from description (last line/paragraph)
- Build clean task_prompt (remove tags and trigger)

**Step 5**: Filter and return only eligible tasks with execution triggers

## Why This Approach

The Teamwork MCP API does not support filtering by status IDs or status names in the `list_tasks_by_project` call. Status filtering must be done client-side after fetching all tasks. The `status` field in the API response is a lowercase string (e.g., "new", "to do", "in progress").

## Example

```bash
/get_teamwork_tasks 12345 '["New", "To Do"]' 10
```

Returns tasks from project 12345 with status "New" or "To Do", up to 10 tasks.
