#!/bin/bash
# execute-claude-workflow.sh - BMAD-style wrapper for claude -p execution
# Solves Python subprocess rate limiting by using bash execution instead
set -e

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <slash_command> <prompt_text> [working_dir] [model] [mcp_config]" >&2
    echo "Example: $0 /build 'Add a test function' /path/to/worktree sonnet .mcp.json" >&2
    exit 1
fi

SLASH_COMMAND="$1"
PROMPT_TEXT="$2"
WORKING_DIR="${3:-.}"
MODEL="${4:-sonnet}"
MCP_CONFIG="${5:-}"

# Debug output
echo "=== Claude Workflow Execution ===" >&2
echo "Command: $SLASH_COMMAND" >&2
echo "Working Dir: $WORKING_DIR" >&2
echo "Model: $MODEL" >&2
if [ -n "$MCP_CONFIG" ]; then
    echo "MCP Config: $MCP_CONFIG" >&2
fi
echo "Prompt length: ${#PROMPT_TEXT} chars" >&2
echo "" >&2

# Change to working directory
cd "$WORKING_DIR"

# Build command
CMD="claude -p --dangerously-skip-permissions --model $MODEL --output-format stream-json --verbose"

# Add MCP config if provided and exists
if [ -n "$MCP_CONFIG" ] && [ -f "$MCP_CONFIG" ]; then
    CMD="$CMD --mcp-config $MCP_CONFIG"
fi

# Add slash command
CMD="$CMD \"$SLASH_COMMAND\""

# Execute claude with prompt via stdin (BMAD-style approach)
# This avoids Python subprocess rate limiting
echo "$PROMPT_TEXT" | eval $CMD

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "" >&2
    echo "✅ Workflow completed successfully" >&2
else
    echo "" >&2
    echo "❌ Workflow failed with exit code: $EXIT_CODE" >&2
fi

exit $EXIT_CODE
