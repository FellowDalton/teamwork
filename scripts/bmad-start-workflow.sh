#!/bin/bash
# bmad-start-workflow.sh - Starts BMAD workflow in current directory

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cleanup function to kill orphaned servers and remove temp logs
cleanup_servers() {
  echo -e "${YELLOW}🧹 Cleaning up background servers and temp files...${NC}"
  # Kill any child processes started in this session
  pkill -P $$ 2>/dev/null || true
  # Clean up temp logs from all sessions
  rm -f /tmp/bmad-backend-*.log /tmp/bmad-frontend-*.log 2>/dev/null || true
  echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Register cleanup to run on script exit, Ctrl+C, or kill
trap cleanup_servers EXIT INT TERM

STORY_PATH="$1"

if [ -z "$STORY_PATH" ]; then
  echo -e "${RED}Error: Story path is required${NC}"
  echo "Usage: $0 <path-to-story>"
  echo "Example: $0 /path/to/docs/stories/backend/story-1-1-api-endpoint.md"
  exit 1
fi

if [ ! -f "$STORY_PATH" ]; then
  echo -e "${RED}Error: Story file not found: $STORY_PATH${NC}"
  exit 1
fi

# Get current branch name
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

# Get project root (current worktree root)
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

echo -e "${BLUE}=========================================="
echo "BMAD Automated Development Workflow"
echo "==========================================${NC}"
echo -e "${GREEN}Story:${NC} $STORY_PATH"
echo -e "${GREEN}Branch:${NC} $BRANCH_NAME"
echo -e "${GREEN}Working Directory:${NC} $PROJECT_ROOT"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Determine if frontend or backend based on story path
MCP_CONFIG_SOURCE=""
if [[ "$STORY_PATH" == *"frontend"* ]] || [[ "$STORY_PATH" == *"ui"* ]] || [[ "$STORY_PATH" == *"client"* ]]; then
  MCP_CONFIG_SOURCE=".mcp.json.frontend"
  echo -e "${YELLOW}📱 Detected: FRONTEND story${NC}"
elif [[ "$STORY_PATH" == *"backend"* ]] || [[ "$STORY_PATH" == *"api"* ]] || [[ "$STORY_PATH" == *"server"* ]]; then
  MCP_CONFIG_SOURCE=".mcp.json.backend"
  echo -e "${YELLOW}🔧 Detected: BACKEND story${NC}"
else
  echo -e "${RED}⚠️  Warning: Could not auto-detect story type from path${NC}"
  echo -e "${YELLOW}Please specify: Is this a (f)rontend or (b)ackend story?${NC}"
  read -p "Enter 'f' or 'b': " story_type
  if [[ "$story_type" == "f" ]]; then
    MCP_CONFIG_SOURCE=".mcp.json.frontend"
    echo -e "${GREEN}Using frontend configuration${NC}"
  else
    MCP_CONFIG_SOURCE=".mcp.json.backend"
    echo -e "${GREEN}Using backend configuration${NC}"
  fi
fi

# Find the main project root (not the worktree) to get the source MCP config
MAIN_PROJECT_ROOT="$(git rev-parse --show-toplevel)"
if [[ "$MAIN_PROJECT_ROOT" == *"/worktrees/"* ]]; then
  # We're in a worktree, find the main project root
  MAIN_PROJECT_ROOT="$(dirname "$(dirname "$MAIN_PROJECT_ROOT")")"
fi

# Verify MCP config source exists
if [ ! -f "$MAIN_PROJECT_ROOT/$MCP_CONFIG_SOURCE" ]; then
  echo -e "${RED}Error: MCP config source not found: $MAIN_PROJECT_ROOT/$MCP_CONFIG_SOURCE${NC}"
  exit 1
fi

# Copy MCP config to current directory
echo -e "${BLUE}Configuring MCP settings...${NC}"
cp "$MAIN_PROJECT_ROOT/$MCP_CONFIG_SOURCE" "$PROJECT_ROOT/.mcp.json"

if [ -f "$PROJECT_ROOT/.mcp.json" ]; then
  echo -e "${GREEN}✅ MCP config created: .mcp.json${NC}"
else
  echo -e "${RED}❌ Error: Failed to create .mcp.json${NC}"
  exit 1
fi

MCP_CONFIG=".mcp.json"
echo -e "${GREEN}Using MCP config:${NC} $MCP_CONFIG"
echo ""

# Define frontend testing instructions if this is a frontend story
FRONTEND_TESTING_INSTRUCTIONS=""
if [[ "$MCP_CONFIG_SOURCE" == ".mcp.json.frontend" ]]; then
  FRONTEND_TESTING_INSTRUCTIONS="

FRONTEND TESTING INSTRUCTIONS (CRITICAL):
9. SERVER MANAGEMENT - Use the dev-server-orchestration skill with REGISTRY SYSTEM:
   - Consult .claude/skills/dev-server-orchestration/SKILL.md for complete instructions
   - The skill uses a REGISTRY (.claude/skills/dev-server-orchestration/registry/active-servers.json)
   - Registry tracks servers by branch name and automatically REUSES existing servers
   - Key scripts:
     * start-backend.sh - Start backend (registry assigns port or reuses existing)
     * start-frontend.sh - Start frontend (registry assigns port or reuses existing)
     * cleanup-servers.sh - Graceful shutdown, log cleanup, and registry removal
10. Before testing any frontend functionality, you MUST start BOTH servers:
    - Follow \"Scenario C: Full-Stack Feature Testing\" in the skill
    - Scripts automatically check registry: if branch already has servers → instant reuse
    - Scripts handle port assignment via registry (starting from 3002, skipping conflicts)
    - NEVER hardcode port numbers - always use \$BACKEND_PORT and \$FRONTEND_PORT variables
11. BROWSER PAGE ISOLATION FOR PARALLEL TESTING (CRITICAL):
    - When multiple agents test simultaneously, each MUST use a separate browser page/tab
    - Check if your branch has a page: eval \$(bash .claude/skills/dev-server-orchestration/scripts/get-page-index.sh \"\$BRANCH\")
    - If \$PAGE_INDEX is empty: Create new page with mcp__chrome-devtools__new_page, get index from list_pages, then register it
    - If \$PAGE_INDEX exists: Select it with mcp__chrome-devtools__select_page before testing
    - See \"Browser Page Management for Parallel Testing\" section in skill for complete workflow
    - NEVER skip page management when testing in parallel - it prevents conflicts and timeouts
12. Once BOTH servers are running and page is selected:
    - Use Chrome DevTools MCP tools to test the implementation in YOUR isolated page
    - Navigate using registry-assigned \$FRONTEND_PORT variable
    - Use mcp__chrome-devtools__navigate_page, take_snapshot, click, fill, hover
    - Check for JavaScript errors with list_console_messages (must be zero)
    - Verify API calls go to registry-assigned \$BACKEND_PORT with list_network_requests
13. CRITICAL CLEANUP RULES:
    - Close your browser page: mcp__chrome-devtools__close_page with pageIdx=\$PAGE_INDEX
    - Unregister page: bash .claude/skills/dev-server-orchestration/scripts/unregister-page.sh \"\$BRANCH\"
    - ALWAYS use cleanup-servers.sh script (automatically unregisters from registry and pages)
    - Pass YOUR session PIDs only (\$BACKEND_PID \$FRONTEND_PID)
    - NEVER use killall, pkill, or search for processes by name
    - Registry ensures proper cleanup and port availability for future runs"
fi

# Function to format Claude CLI output for terminal display
# Takes stream-json input and outputs concise, readable format
format_claude_output() {
  while IFS= read -r line; do
    # Pass through to log file (via tee)
    echo "$line"

    # Parse JSON and extract relevant info for terminal display
    local msg_type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)

    if [ "$msg_type" = "assistant" ]; then
      # Extract tool uses
      local tools=$(echo "$line" | jq -r '.message.content[]? | select(.type=="tool_use") | "🔧 \(.name): \(.input | tostring | .[0:100])"' 2>/dev/null)
      if [ -n "$tools" ]; then
        echo -e "${BLUE}${tools}${NC}" >&2
      fi

      # Extract text messages
      local text=$(echo "$line" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null)
      if [ -n "$text" ]; then
        # Truncate long messages
        local truncated=$(echo "$text" | head -c 200)
        if [ ${#text} -gt 200 ]; then
          truncated="${truncated}..."
        fi
        echo -e "${GREEN}💬 ${truncated}${NC}" >&2
      fi
    fi
  done
}

# Function to run dev agent (initial implementation)
run_dev_agent_initial() {
  local iteration=$1
  echo -e "${BLUE}==========================================${NC}"
  echo -e "${BLUE}🔨 DEV AGENT - Initial Implementation${NC}"
  echo -e "${BLUE}==========================================${NC}"

  local system_instructions="IMPORTANT INSTRUCTIONS:
1. Read the story file and identify ALL unchecked tasks (marked with [ ])
2. Work through EACH unchecked task systematically, one at a time
3. For each task, implement the required code changes to satisfy the acceptance criteria
4. Check off each task (change [ ] to [x]) as you complete it
5. Do NOT consider the story complete until ALL tasks are checked off
6. If there are QA results showing failures, address ALL critical blockers and failed acceptance criteria
7. Write actual working code - do not create mockups or placeholders
8. Implement full functionality including API integration, error handling, and accessibility features${FRONTEND_TESTING_INSTRUCTIONS}"

  local command_message="2. develop-story @${STORY_PATH}"

  echo "$command_message" | claude -p "/BMad:agents:dev" \
    --mcp-config "$MCP_CONFIG" \
    --append-system-prompt "$system_instructions" \
    --dangerously-skip-permissions \
    --verbose \
    --output-format stream-json \
    | format_claude_output \
    | tee "bmad-dev-iteration-${iteration}.log" >/dev/null

  local exit_code=${PIPESTATUS[0]}
  
  if [ $exit_code -ne 0 ]; then
    echo -e "${RED}❌ Dev agent failed with exit code: $exit_code${NC}"
    return 1
  fi
  
  echo -e "${GREEN}✅ Dev agent completed iteration $iteration${NC}"
  echo ""
  return 0
}

# Function to run dev agent (fixing QA issues)
run_dev_agent_qa_fixes() {
  local iteration=$1
  echo -e "${BLUE}==========================================${NC}"
  echo -e "${BLUE}🔨 DEV AGENT - Fixing QA Issues (Iteration $iteration)${NC}"
  echo -e "${BLUE}==========================================${NC}"

  local system_instructions="IMPORTANT INSTRUCTIONS:
1. Read the QA results in the story file to understand what failed
2. Address EVERY critical blocker and failed acceptance criterion identified by QA
3. Work through each issue systematically, implementing complete solutions
4. Check off any remaining unchecked tasks ([ ] → [x]) as you complete them
5. Fix ALL code quality issues, accessibility violations, and missing test coverage
6. Implement actual working functionality - no mockups or placeholders
7. After fixes, verify the implementation meets ALL acceptance criteria
8. Do NOT consider the work complete until all QA issues are resolved${FRONTEND_TESTING_INSTRUCTIONS}"

  local command_message="4. review-qa @${STORY_PATH}"

  echo "$command_message" | claude -p "/BMad:agents:dev" \
    --mcp-config "$MCP_CONFIG" \
    --append-system-prompt "$system_instructions" \
    --dangerously-skip-permissions \
    --verbose \
    --output-format stream-json \
    | format_claude_output \
    | tee "bmad-dev-iteration-${iteration}.log" >/dev/null

  local exit_code=${PIPESTATUS[0]}
  
  if [ $exit_code -ne 0 ]; then
    echo -e "${RED}❌ Dev agent failed with exit code: $exit_code${NC}"
    return 1
  fi
  
  echo -e "${GREEN}✅ Dev agent completed QA fixes iteration $iteration${NC}"
  echo ""
  return 0
}

# Function to run QA agent
run_qa_agent() {
  local iteration=$1
  echo -e "${BLUE}==========================================${NC}"
  echo -e "${BLUE}🔍 QA AGENT - Iteration $iteration${NC}"
  echo -e "${BLUE}==========================================${NC}"

  local system_instructions="IMPORTANT QA INSTRUCTIONS:
1. Verify that ALL tasks in the story are checked off as complete ([x])
2. Test that EVERY acceptance criterion is fully met with working code
3. Check for actual functionality - not mockups or placeholder code
4. Verify API integration, error handling, accessibility, and test coverage
5. If ANY acceptance criteria fail or tasks are incomplete, report QA FAILED
6. Only report QA APPROVED if all 10/10 acceptance criteria are fully implemented
7. Be thorough - check actual code implementation, not just surface-level completion
8. MANDATORY BROWSER TESTING FOR FRONTEND STORIES:
   a. Use the dev-server-orchestration skill (.claude/skills/dev-server-orchestration/SKILL.md)
   b. CRITICAL REGISTRY-BASED PORT MANAGEMENT: Never assume or hardcode port numbers!
      - Registry automatically tracks servers by branch name
      - Scripts reuse existing servers if already running for your branch
      - Always use \$BACKEND_PORT and \$FRONTEND_PORT variables from scripts
   c. If frontend server fails to start, check error messages:
      - If errors reference story implementation files (stores, pages, components) → QA FAILS
      - Common bugs: Pinia persist issues, missing imports, invalid composable usage
      - DO NOT assume all server errors are environment issues
   d. BROWSER PAGE ISOLATION (CRITICAL for parallel testing):
      - Get/create isolated page: eval \$(bash .claude/skills/dev-server-orchestration/scripts/get-page-index.sh \"\$BRANCH\")
      - If no page: Create with mcp__chrome-devtools__new_page, then register it
      - If page exists: Select with mcp__chrome-devtools__select_page before testing
      - See \"Browser Page Management\" section in skill for complete workflow
      - This prevents conflicts when multiple QA agents run in parallel
   e. Once servers running and page selected, test in actual browser:
      - Navigate using registry-assigned port variables (\$FRONTEND_PORT)
      - Take snapshot to verify rendering
      - Test ALL interactive features
      - Check console for errors (must be zero)
      - Verify network requests go to registry-assigned \$BACKEND_PORT
   f. Document EXACTLY what testing you performed in QA Results section
   g. If you cannot test in browser due to story bugs → QA FAILS immediately
   h. Clean up: Close page with mcp__chrome-devtools__close_page, then cleanup-servers.sh
9. CRITICAL: Frontend stories CANNOT be approved without completing browser testing${FRONTEND_TESTING_INSTRUCTIONS}"

  local command_message="4. review @${STORY_PATH}"

  echo "$command_message" | claude -p "/BMad:agents:qa" \
    --mcp-config "$MCP_CONFIG" \
    --append-system-prompt "$system_instructions" \
    --dangerously-skip-permissions \
    --verbose \
    --output-format stream-json \
    | format_claude_output \
    | tee "bmad-qa-iteration-${iteration}.log" >/dev/null

  local exit_code=${PIPESTATUS[0]}

  if [ $exit_code -ne 0 ]; then
    echo -e "${RED}❌ QA agent failed with exit code: $exit_code${NC}"
    return 1
  fi

  # Check if QA approved or failed (check failures FIRST to avoid false positives)
  if grep -qi "QA.*FAILED\|VERDICT.*FAILED\|ISSUES FOUND\|NEED.*FIX" "bmad-qa-iteration-${iteration}.log"; then
    echo -e "${YELLOW}⚠️  QA FAILED - Issues found, need to fix${NC}"
    return 1
  elif grep -qi "QA.*APPROVED\|VERDICT.*APPROVED\|STATUS.*APPROVED" "bmad-qa-iteration-${iteration}.log"; then
    echo -e "${GREEN}✅ QA APPROVED - No issues found${NC}"
    return 0
  else
    # Default to assuming issues exist if unclear
    echo -e "${YELLOW}⚠️  QA result unclear - checking for issue keywords...${NC}"
    if grep -qi "issue\|error\|bug\|problem\|fix\|incorrect\|wrong" "bmad-qa-iteration-${iteration}.log"; then
      echo -e "${YELLOW}⚠️  Found potential issues - assuming QA failed${NC}"
      return 1
    else
      echo -e "${GREEN}✅ No clear issues found - assuming QA passed${NC}"
      return 0
    fi
  fi
}

# Function to run PO agent to validate story completion
run_po_agent() {
  local po_cycle=$1
  echo -e "${BLUE}==========================================${NC}"
  echo -e "${BLUE}📋 PO AGENT - Checking Story Status (Cycle $po_cycle)${NC}"
  echo -e "${BLUE}==========================================${NC}"

  local system_instructions="IMPORTANT PO REVIEW INSTRUCTIONS:
1. Verify that ALL acceptance criteria (AC 1-10) are fully implemented
2. Check that ALL tasks in the story are marked complete ([x])
3. Review the QA results - if QA reported failures, more work is needed
4. Verify the implementation delivers actual business value, not just technical code
5. Check that the feature works end-to-end for the user story
6. Only mark as STORY DONE if the implementation is production-ready
7. If any acceptance criteria are missing or incomplete, report MORE WORK needed
8. Be the advocate for the user - ensure quality meets production standards"

  local command_message="Review the story at @${STORY_PATH} and determine if it is complete and ready to be marked as DONE, or if more work is needed."

  echo "$command_message" | claude -p "/BMad:agents:po" \
    --append-system-prompt "$system_instructions" \
    --dangerously-skip-permissions \
    --verbose \
    --output-format stream-json \
    | format_claude_output \
    | tee "bmad-po-cycle-${po_cycle}.log" >/dev/null

  local exit_code=${PIPESTATUS[0]}

  if [ $exit_code -ne 0 ]; then
    echo -e "${RED}❌ PO agent failed with exit code: $exit_code${NC}"
    return 1
  fi

  # Check if PO says story is DONE or needs MORE WORK (check rejection FIRST to avoid false positives)
  if grep -qi "MORE.*WORK\|NOT.*COMPLETE\|NEED.*FIX\|CRITERIA.*NOT.*MET\|ADDITIONAL.*WORK\|VERDICT.*MORE.*WORK" "bmad-po-cycle-${po_cycle}.log"; then
    echo -e "${YELLOW}⚠️  PO REVIEW - More work needed before story can be marked DONE${NC}"
    return 1
  elif grep -qi "PO.*APPROVED\|VERDICT.*APPROVED\|STORY.*COMPLETE.*AND.*READY" "bmad-po-cycle-${po_cycle}.log"; then
    echo -e "${GREEN}✅ PO APPROVED - Story is complete and ready to be marked DONE${NC}"
    return 0
  else
    # Default to requesting more work if unclear
    echo -e "${YELLOW}⚠️  PO result unclear - checking for completion keywords...${NC}"
    if grep -qi "incomplete\|missing\|issue\|concern\|problem" "bmad-po-cycle-${po_cycle}.log"; then
      echo -e "${YELLOW}⚠️  Found concerns - assuming more work needed${NC}"
      return 1
    else
      echo -e "${GREEN}✅ No clear issues found - assuming PO approved${NC}"
      return 0
    fi
  fi
}

# Main development loop with PO review cycles
MAX_ITERATIONS=5
MAX_PO_CYCLES=3
po_cycle=1
po_approved=false

# Outer loop: PO review cycles
while [ "$po_approved" = false ] && [ $po_cycle -le $MAX_PO_CYCLES ]; do
  echo ""
  echo -e "${YELLOW}=========================================="
  echo "PO REVIEW CYCLE $po_cycle"
  echo "==========================================${NC}"
  echo ""

  # Reset dev/QA loop variables for this PO cycle
  iteration=1
  qa_passed=false

  echo ""
  echo -e "${YELLOW}=========================================="
  echo "ITERATION 1 - Initial Implementation"
  echo "==========================================${NC}"
  echo ""

  # Run initial dev agent
  if ! run_dev_agent_initial $iteration; then
    echo -e "${RED}❌ Initial development failed. Exiting.${NC}"
    exit 1
  fi

  # Commit changes after initial dev
  echo -e "${YELLOW}📝 Committing initial implementation...${NC}"
  git add .
  git commit -m "Dev iteration 1 (PO cycle $po_cycle): Initial implementation of $(basename $STORY_PATH .md)" || echo "No changes to commit"

  # Run initial QA
  if run_qa_agent $iteration; then
    qa_passed=true
  else
    echo -e "${YELLOW}🔄 QA found issues. Will start fix iterations...${NC}"
    iteration=$((iteration + 1))
  fi

  # Continue with fix iterations if needed
  while [ "$qa_passed" = false ] && [ $iteration -le $MAX_ITERATIONS ]; do
    echo ""
    echo -e "${YELLOW}=========================================="
    echo "ITERATION $iteration - Fixing QA Issues"
    echo "==========================================${NC}"
    echo ""

    sleep 2

    # Run dev agent with QA fixes
    if ! run_dev_agent_qa_fixes $iteration; then
      echo -e "${RED}❌ Development failed while fixing QA issues. Exiting.${NC}"
      exit 1
    fi

    # Commit changes after dev fixes
    echo -e "${YELLOW}📝 Committing dev fixes...${NC}"
    git add .
    git commit -m "Dev iteration $iteration (PO cycle $po_cycle): Fix QA issues for $(basename $STORY_PATH .md)" || echo "No changes to commit"

    # Run QA agent again
    if run_qa_agent $iteration; then
      qa_passed=true
      break
    fi

    # QA still found issues, continue to next iteration
    echo -e "${YELLOW}🔄 QA still found issues. Starting next iteration...${NC}"
    iteration=$((iteration + 1))
  done

  # If QA loop maxed out, exit
  if [ "$qa_passed" = false ]; then
    echo -e "${RED}❌ FAILED: Maximum dev/QA iterations ($MAX_ITERATIONS) reached${NC}"
    echo -e "${YELLOW}QA issues still exist. Manual intervention required.${NC}"
    break
  fi

  # QA passed - now run PO agent to check if story is truly complete
  echo ""
  echo -e "${YELLOW}🔄 QA passed. Running PO review to check if story is complete...${NC}"
  sleep 2

  if run_po_agent $po_cycle; then
    po_approved=true
    break
  else
    # PO says more work is needed
    echo -e "${YELLOW}🔄 PO review indicates more work needed. Starting next PO cycle...${NC}"

    # Commit PO feedback
    git add .
    git commit -m "PO cycle $po_cycle: PO review completed, more work needed for $(basename $STORY_PATH .md)" || echo "No changes to commit"

    po_cycle=$((po_cycle + 1))
    sleep 3
  fi
done

echo ""
echo -e "${BLUE}==========================================${NC}"

if [ "$po_approved" = true ]; then
  echo -e "${GREEN}✅ SUCCESS! Story implementation complete and PO approved${NC}"
  echo -e "${GREEN}Completed after $po_cycle PO review cycle(s)${NC}"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. Review the changes: git diff main"
  echo "  2. Push the branch: git push origin $BRANCH_NAME"
  echo "  3. Create a pull request"
  echo "  4. Mark story as DONE"
  echo ""

  # Final commit
  git add .
  git commit -m "PO approved: $(basename $STORY_PATH .md) - Story complete and ready for merge" || echo "No final changes"

else
  if [ "$qa_passed" = false ]; then
    echo -e "${RED}❌ FAILED: Maximum dev/QA iterations ($MAX_ITERATIONS) reached${NC}"
    echo -e "${YELLOW}QA issues still exist. Manual intervention required.${NC}"
  else
    echo -e "${RED}❌ FAILED: Maximum PO review cycles ($MAX_PO_CYCLES) reached${NC}"
    echo -e "${YELLOW}Story implementation not meeting acceptance criteria. Manual review required.${NC}"
  fi
  echo ""
  echo "Review logs:"
  ls -la bmad-*.log
  echo ""
fi

echo -e "${BLUE}==========================================${NC}"
echo ""
echo -e "${YELLOW}Press any key to close this window...${NC}"
read -n 1

exit 0