#!/bin/bash
# tw.sh - Teamwork CLI assistant using Claude
# Usage: tw [mode] "your prompt"
# Modes: status, timelog, project, or omit for general
#
# TODO: This script uses Claude Code CLI for now.
# For production, migrate to using the backend /api/claude endpoint
# which will eventually use the Anthropic Agent SDK.

set -e

# Unset API key to use Claude CLI subscription auth
unset ANTHROPIC_API_KEY

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROMPTS_DIR="$PROJECT_ROOT/prompts/teamwork-cli"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
MODE="base"
PROMPT=""

if [ $# -eq 0 ]; then
  echo -e "${BLUE}Teamwork CLI Assistant${NC}"
  echo ""
  echo "Usage: tw [mode] \"your prompt\""
  echo ""
  echo "Modes:"
  echo "  status   - Activity and work status queries"
  echo "  timelog  - Time tracking queries"
  echo "  project  - Project management queries"
  echo "  (none)   - General queries"
  echo ""
  echo "Examples:"
  echo "  tw status \"What did I work on today?\""
  echo "  tw timelog \"Show my recent time entries\""
  echo "  tw project \"What's the status of my projects?\""
  echo "  tw \"Help me understand this codebase\""
  exit 0
fi

# Check if first arg is a mode or the prompt
case "$1" in
  status|timelog|project)
    MODE="$1"
    shift
    PROMPT="$*"
    ;;
  *)
    PROMPT="$*"
    ;;
esac

if [ -z "$PROMPT" ]; then
  echo -e "${YELLOW}Error: No prompt provided${NC}"
  exit 1
fi

# Select system prompt file
SYSTEM_PROMPT_FILE="$PROMPTS_DIR/$MODE.txt"
if [ ! -f "$SYSTEM_PROMPT_FILE" ]; then
  echo -e "${YELLOW}Warning: Prompt file not found: $SYSTEM_PROMPT_FILE${NC}"
  SYSTEM_PROMPT_FILE="$PROMPTS_DIR/base.txt"
fi

echo -e "${BLUE}Mode: $MODE${NC}"

# Ensure backend server is running for data queries
if [[ "$MODE" == "status" || "$MODE" == "timelog" || "$MODE" == "project" ]]; then
  if ! curl -s http://localhost:3051/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting backend server...${NC}"
    cd "$PROJECT_ROOT/apps/teamwork_frontend"
    bun run server.ts > /dev/null 2>&1 &
    sleep 3
  fi
fi

# For status mode, auto-fetch activity data and include it
if [[ "$MODE" == "status" ]]; then
  # Detect period from prompt
  PERIOD="today"
  if echo "$PROMPT" | grep -qi "yesterday"; then
    PERIOD="yesterday"
  elif echo "$PROMPT" | grep -qi "this week\|thisweek"; then
    PERIOD="thisweek"
  elif echo "$PROMPT" | grep -qi "last week\|lastweek"; then
    PERIOD="lastweek"
  fi
  
  echo -e "${BLUE}Fetching activity data (${PERIOD})...${NC}"
  ACTIVITY_DATA=$(curl -s "http://localhost:3051/api/activity-status?period=${PERIOD}")
  
  # Combine prompt with data
  FULL_PROMPT="User question: $PROMPT

Activity data:
$ACTIVITY_DATA"
  
  cd "$PROJECT_ROOT"
  echo "$FULL_PROMPT" | claude -p \
    --system-prompt-file "$SYSTEM_PROMPT_FILE"
else
  # Regular mode - just pass the prompt
  cd "$PROJECT_ROOT"
  claude -p \
    --system-prompt-file "$SYSTEM_PROMPT_FILE" \
    "$PROMPT"
fi

echo ""
echo -e "${GREEN}Done${NC}"
