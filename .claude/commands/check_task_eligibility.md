# Check Task Eligibility

Check if a Teamwork task is eligible for automated processing.

## Usage

```bash
/check_task_eligibility <task_description>
```

## Parameters

- `task_description` (required): Task description text (string)

## Functionality

1. Check if description ends with `execute` keyword
2. Check if description contains `continue - <prompt>` pattern
3. Return eligibility status and execution trigger type

## Response Format

```json
{
  "eligible": true,
  "execution_trigger": "execute",
  "trigger_found_at": "end of description"
}
```

Or:

```json
{
  "eligible": true,
  "execution_trigger": "continue",
  "continuation_prompt": "Add error handling and tests",
  "trigger_found_at": "line 15"
}
```

Or:

```json
{
  "eligible": false,
  "execution_trigger": null,
  "reason": "No execution trigger found"
}
```

## Execution Triggers

- **`execute`**: Task ends with the word "execute" (case-insensitive)
  - Example: `"...implement the feature\n\nexecute"`
  - Trigger type: "execute"

- **`continue - <prompt>`**: Task contains continuation instruction
  - Example: `"...continue - Add comprehensive error handling"`
  - Trigger type: "continue"
  - Extracts continuation prompt

## Notes

- NO MCP calls - pure text parsing
- Fast and lightweight
- Use this to filter tasks before processing

## Example

```bash
/check_task_eligibility "Create a CLI tool for JSON formatting\n\nexecute"
# Returns: {"eligible": true, "execution_trigger": "execute"}

/check_task_eligibility "Create a CLI tool for JSON formatting"
# Returns: {"eligible": false, "execution_trigger": null}

/check_task_eligibility "Initial work done\n\ncontinue - Add comprehensive tests"
# Returns: {"eligible": true, "execution_trigger": "continue", "continuation_prompt": "Add comprehensive tests"}
```
