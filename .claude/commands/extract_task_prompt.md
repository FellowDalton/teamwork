# Extract Task Prompt

Extract clean task prompt from Teamwork task description.

## Usage

```bash
/extract_task_prompt <task_description> <execution_trigger>
```

## Parameters

- `task_description` (required): Full task description text
- `execution_trigger` (required): Type of trigger ("execute" or "continue")

## Functionality

1. Remove inline tags: `{{key: value}}`
2. Remove execution trigger based on type:
   - For "execute": Remove trailing "execute" keyword
   - For "continue": Extract prompt after "continue - "
3. Trim whitespace and return clean prompt

## Response Format

```json
{
  "original_length": 523,
  "cleaned_prompt": "Create a TypeScript CLI tool using Bun that reads JSON from stdin...",
  "cleaned_length": 456,
  "removed_elements": ["{{prototype: bun_scripts}}", "execute"]
}
```

## Notes

- NO MCP calls - pure text processing
- Fast and lightweight
- Preserves all meaningful content, only removes metadata

## Example

```bash
/extract_task_prompt "Create a CLI tool\n\n{{prototype: bun_scripts}}\n\nexecute" "execute"
# Returns: "Create a CLI tool"

/extract_task_prompt "Initial implementation complete\n\ncontinue - Add error handling" "continue"
# Returns: "Add error handling"
```
