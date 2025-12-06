#!/bin/bash
# activity-status.sh - Get user activity status from Teamwork via Claude CLI

set -e

# Unset API key to use Claude CLI subscription auth instead
unset ANTHROPIC_API_KEY

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default period
PERIOD="${1:-today}"

echo -e "${BLUE}Fetching activity for: ${PERIOD}${NC}"

# Ensure backend server is running
if ! curl -s http://localhost:3051/api/health > /dev/null 2>&1; then
  echo -e "${YELLOW}Starting backend server...${NC}"
  cd "$(dirname "$0")/../apps/teamwork_frontend"
  bun run server.ts &
  sleep 3
fi

# Fetch activity data from API
ACTIVITY_DATA=$(curl -s "http://localhost:3051/api/activity-status?period=${PERIOD}")

if [ -z "$ACTIVITY_DATA" ] || echo "$ACTIVITY_DATA" | grep -q '"error"'; then
  echo -e "${YELLOW}Error fetching activity data${NC}"
  echo "$ACTIVITY_DATA"
  exit 1
fi

# Format the data nicely using Claude
SYSTEM_PROMPT="You are a work activity reporter. Given JSON data about a user's work activity, provide a concise, human-readable summary.

Format the output as:
1. A brief header with the user name and date range
2. Key metrics (hours logged, tasks worked on)
3. If there are time entries, list them briefly
4. If there are activities, mention the highlights

Keep it brief and scannable. Use simple formatting, no markdown headers."

echo "$ACTIVITY_DATA" | claude -p \
  --append-system-prompt "$SYSTEM_PROMPT" \
  "Summarize this work activity data:"

echo ""
echo -e "${GREEN}Done${NC}"
