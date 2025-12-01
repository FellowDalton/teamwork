# List Teamwork Tasks

Simple command to list tasks from a Teamwork project with minimal processing.

## Usage

```bash
/list_teamwork_tasks <project_id> [limit]
```

## Parameters

- `project_id` (required): Teamwork project ID
- `limit` (optional): Max tasks to return, default: `10`

## Functionality

1. Call `mcp__teamwork__twprojects-list_tasks_by_project` with project_id
2. Return raw task data as JSON array
3. NO filtering, NO parsing, NO nested calls

## Response Format

Returns raw Teamwork API response with task list:

```json
{
  "tasks": [
    {
      "id": 26737953,
      "name": "Build Bun CLI: JSON Pretty Printer",
      "status": "new",
      "description": "...",
      "tags": [{"id": 110634, "type": "tags"}, {"id": 110655, "type": "tags"}],
      "priority": "medium",
      "createdAt": "2025-11-09T21:44:44Z"
    }
  ]
}
```

## Notes

- This is a lightweight command with only ONE MCP call
- Use other commands to process the results:
  - `/parse_task_tags` - Parse tags for a single task
  - `/check_task_eligibility` - Check if task has execution trigger
  - `/extract_task_prompt` - Extract clean prompt from description

## Example

```bash
/list_teamwork_tasks 805682 10
```
