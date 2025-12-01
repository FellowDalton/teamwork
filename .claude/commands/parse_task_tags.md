# Parse Task Tags

Extract and parse tags from a single Teamwork task.

## Usage

```bash
/parse_task_tags <task_json>
```

## Parameters

- `task_json` (required): JSON string or object of a single task (from list_teamwork_tasks)

## Functionality

1. Extract tag IDs from task.tags array
2. For each tag ID, call `mcp__teamwork__twprojects-get_tag` to get tag name
3. Parse tag names in "key:value" format (e.g., "prototype:bun_scripts")
4. Extract inline tags from description using regex: `\{\{(\w+):\s*([^}]+)\}\}`
5. Merge tags (native tags take precedence over inline tags)
6. Return tags as key-value dictionary

## Response Format

```json
{
  "native_tags": {
    "prototype": "bun_scripts",
    "model": "sonnet"
  },
  "inline_tags": {
    "worktree": "proto-json-parser"
  },
  "merged_tags": {
    "prototype": "bun_scripts",
    "model": "sonnet",
    "worktree": "proto-json-parser"
  }
}
```

## Notes

- Makes N MCP calls where N = number of tags (typically 2-3)
- Native tags in "key:value" format are parsed into dictionary
- Inline tags are fallback for custom metadata
- Merged tags prioritize native over inline

## Example

```bash
# First get task
/list_teamwork_tasks 805682 1

# Then parse tags for specific task
/parse_task_tags '{"id":26737953,"tags":[{"id":110655}],"description":"..."}'
```
