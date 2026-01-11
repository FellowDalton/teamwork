# Plan: Server-SDK Modular Refactoring

## Metadata
adw_id: `@specs/REFACTOR-SPEC.md`
prompt: `Split monolithic server-sdk.ts (3634 lines) into focused modules following the extraction plan in REFACTOR-SPEC.md`
task_type: refactor
complexity: complex

## Task Description
The `apps/teamwork_backend/server-sdk.ts` file has grown to 3634 lines and needs to be split into focused, maintainable modules. The refactoring must:
1. Extract code into a well-organized `lib/` directory structure
2. Maintain all existing functionality (no behavioral changes)
3. Follow a specific extraction order to minimize dependency issues
4. Test after each phase using browser tests defined in REFACTOR-BROWSER-TESTS.md

## Objective
Transform the monolithic 3634-line `server-sdk.ts` into a modular architecture with:
- Utils modules for shared helpers (response, safety, date-parsing)
- MCP module for Teamwork tools and server factory
- Agents modules for AI agent functions (visualization, chat, agentic-status)
- Handlers modules for API endpoint handlers
- A streamlined entry point for routing and server setup

## Problem Statement
The current `server-sdk.ts` contains:
- Date parsing logic (~185 lines)
- Safety validation (~40 lines)
- Configuration (~15 lines)
- MCP tools and server (~300 lines)
- 3 agent functions (~400 lines total)
- 5+ handler functions (~1500 lines)
- HTTP routing and server (~200 lines)
- Various helpers scattered throughout

This monolithic structure makes:
- Testing individual components difficult
- Finding specific functionality slow
- Understanding the codebase overwhelming
- Adding new features risky (high coupling)

## Solution Approach
Extract modules in dependency order (least dependencies first):
1. **Phase 1 (Utils):** Extract pure utility functions with no dependencies on other modules
2. **Phase 2 (MCP):** Extract MCP tools that depend on Teamwork client
3. **Phase 3 (Agents):** Extract agent functions that depend on SDK query function
4. **Phase 4 (Handlers):** Extract HTTP handlers that orchestrate agents and utilities

Each extraction follows the pattern:
1. Create new file with extracted code
2. Add imports in server-sdk.ts
3. Remove duplicated code
4. Verify server starts
5. Run browser tests (for major phases)

## Relevant Files

### Source File
- `apps/teamwork_backend/server-sdk.ts` - The 3634-line monolith to be refactored

### Reference Documentation
- `specs/REFACTOR-SPEC.md` - Detailed extraction instructions with code templates
- `specs/REFACTOR-BROWSER-TESTS.md` - Browser test procedures for each phase

### Existing Dependencies (Do Not Modify)
- `apps/teamwork_backend/teamwork_api_client/` - Teamwork API client (imported by MCP tools)
- `apps/teamwork_backend/types.ts` - Existing type definitions

### New Files to Create

**Phase 1: Utils**
- `apps/teamwork_backend/lib/utils/response.ts` - CORS headers, jsonResponse, errorResponse
- `apps/teamwork_backend/lib/utils/safety.ts` - BLOCKED_WRITE_TOOLS, validateAgentResponse
- `apps/teamwork_backend/config.ts` - PORT, URLs, tokens, ALLOWED_PROJECTS
- `apps/teamwork_backend/lib/utils/date-parsing.ts` - DateRange interface, parseDateRange functions
- `apps/teamwork_backend/lib/utils/index.ts` - Re-exports for utils

**Phase 2: MCP**
- `apps/teamwork_backend/lib/mcp/tools.ts` - createTeamworkTools function
- `apps/teamwork_backend/lib/mcp/index.ts` - createTeamworkMcpServer factory

**Phase 3: Agents**
- `apps/teamwork_backend/lib/agents/visualization.ts` - runVisualizationAgent
- `apps/teamwork_backend/lib/agents/chat.ts` - runChatAgent
- `apps/teamwork_backend/lib/agents/agentic-status.ts` - runAgenticStatusAgent
- `apps/teamwork_backend/lib/agents/index.ts` - Re-exports for agents

**Phase 4: Handlers**
- `apps/teamwork_backend/lib/handlers/agent-chat.ts` - handleAgentChat
- `apps/teamwork_backend/lib/handlers/chart.ts` - handleChartRequest
- `apps/teamwork_backend/lib/handlers/project.ts` - handleProjectChat, handleProjectSubmit, handleProjectUpdate
- `apps/teamwork_backend/lib/handlers/timelog.ts` - handleTimelogChat, handleTimelogSubmit
- `apps/teamwork_backend/lib/handlers/ai-viz.ts` - handleVisualizationRequest
- `apps/teamwork_backend/lib/handlers/index.ts` - Re-exports for handlers

## Implementation Phases

### Phase 1: Foundation (Utils Extraction)
Extract pure utility functions with no internal dependencies. These form the base layer that other modules will import.

Key extractions:
- Response helpers (corsHeaders, jsonResponse, errorResponse) - Lines ~1045-1061
- Safety validation (BLOCKED_WRITE_TOOLS, validateAgentResponse) - Lines ~701-740
- Configuration constants (PORT, URLs, ALLOWED_PROJECTS) - Lines ~652-662
- Date parsing (DateRange, parseDateRangeFast, parseDateRangeWithLLM, parseDateRange) - Lines ~106-291

### Phase 2: MCP Layer
Extract MCP server and tools that depend on TeamworkClient. The MCP server is stateful and created once at startup.

Key extractions:
- Tool definitions (10+ tools for Teamwork operations) - Lines ~747-1043
- MCP server factory function

### Phase 3: Agents Layer
Extract AI agent functions that use the SDK query function. These are the core AI components that process user requests.

Key extractions:
- runVisualizationAgent - Lines ~293-400
- runChatAgent - Lines ~519-628
- runAgenticStatusAgent - Lines ~402-517

After this phase: Run Test Suite 1 (Status Flow)

### Phase 4: Handlers Layer
Extract HTTP handlers that orchestrate agents, MCP tools, and utilities. These are the entry points for API requests.

Key extractions:
- handleAgentChat (main routing) - Lines ~1063-1217
- handleChartRequest - Lines ~1223-1470
- handleProjectChat - Lines ~1497-2240
- handleTimelogChat - Lines ~2242-2490
- handleVisualizationRequest - Lines ~2918-3046

After each handler: Run corresponding test suite

## Step by Step Tasks

### 1. Setup Directory Structure
- Create `apps/teamwork_backend/lib/` directory
- Create subdirectories: `utils/`, `mcp/`, `agents/`, `handlers/`
- Verify directory structure matches target from REFACTOR-SPEC.md

### 2. Extract Response Utilities (Phase 1.1)
- Create `lib/utils/response.ts` with corsHeaders, jsonResponse, errorResponse
- Add import in server-sdk.ts: `import { corsHeaders, jsonResponse, errorResponse } from './lib/utils/response.ts'`
- Remove original definitions from server-sdk.ts
- Run: `bun run server-sdk.ts` - verify starts without errors

### 3. Extract Safety Utilities (Phase 1.2)
- Create `lib/utils/safety.ts` with BLOCKED_WRITE_TOOLS, validateAgentResponse
- Add import in server-sdk.ts
- Remove original definitions
- Run: `bun run server-sdk.ts` - verify starts

### 4. Extract Configuration (Phase 1.3)
- Create `config.ts` in backend root with PORT, TEAMWORK_API_URL, TEAMWORK_BEARER_TOKEN, DEFAULT_PROJECT_ID, ALLOWED_PROJECTS
- Add import in server-sdk.ts
- Remove original definitions
- Run: `bun run server-sdk.ts` - verify starts

### 5. Extract Date Parsing (Phase 1.4)
- Create `lib/utils/date-parsing.ts` with DateRange interface, parseDateRangeFast, parseDateRangeWithLLM, parseDateRange
- Modify functions to accept query, claudeCodePath, agentSdkAvailable as parameters (dependency injection)
- Add import in server-sdk.ts
- Update call sites to pass dependencies
- Remove original definitions
- Run: `bun run server-sdk.ts` - verify starts

### 6. Create Utils Index (Phase 1.5)
- Create `lib/utils/index.ts` with re-exports from response.ts, safety.ts, date-parsing.ts
- Verify Phase 1 complete - server starts without errors

### 7. Extract MCP Tools (Phase 2.1)
- Create `lib/mcp/tools.ts` with createTeamworkTools function
- Function takes teamwork, tool, ALLOWED_PROJECTS as parameters
- Returns array of MCP tools
- Add import in server-sdk.ts

### 8. Extract MCP Server Factory (Phase 2.2)
- Create `lib/mcp/index.ts` with createTeamworkMcpServer function
- Import createTeamworkTools from tools.ts
- Export TeamworkMcpServer type
- Update server-sdk.ts to use factory
- Remove original MCP definitions
- Run: `bun run server-sdk.ts` - verify starts

### 9. Extract Visualization Agent (Phase 3.1)
- Create `lib/agents/visualization.ts` with runVisualizationAgent
- Function takes context, query, claudeCodePath as parameters
- Add import in server-sdk.ts

### 10. Extract Chat Agent (Phase 3.2)
- Create `lib/agents/chat.ts` with runChatAgent
- Function takes context, onChunk, onThinking, query, claudeCodePath as parameters
- Add import in server-sdk.ts

### 11. Extract Agentic Status Agent (Phase 3.3)
- Create `lib/agents/agentic-status.ts` with runAgenticStatusAgent
- Function takes context, onThinking, onVisualization, query, claudeCodePath, teamworkMcpServer as parameters
- Add import in server-sdk.ts

### 12. Create Agents Index (Phase 3.4)
- Create `lib/agents/index.ts` with re-exports
- Remove original agent definitions from server-sdk.ts
- Run: `bun run server-sdk.ts` - verify starts
- **Run Test Suite 1: Status Flow** - verify agents work correctly

### 13. Extract Agent Chat Handler (Phase 4.1)
- Create `lib/handlers/agent-chat.ts` with handleAgentChat
- Function orchestrates routing to other handlers
- Add import in server-sdk.ts
- Remove original definition

### 14. Extract Chart Handler (Phase 4.2)
- Create `lib/handlers/chart.ts` with handleChartRequest
- Add import in server-sdk.ts
- Remove original definition
- Run: `bun run server-sdk.ts` - verify starts
- **Run Test Suite 2: Chart Flow**

### 15. Extract Project Handler (Phase 4.3)
- Create `lib/handlers/project.ts` with handleProjectChat, handleProjectSubmit, handleProjectUpdate
- Also extract extractDataFromResponse helper
- Add imports in server-sdk.ts
- Remove original definitions
- Run: `bun run server-sdk.ts` - verify starts
- **Run Test Suite 3: Project Flow**

### 16. Extract Timelog Handler (Phase 4.4)
- Create `lib/handlers/timelog.ts` with handleTimelogChat, handleTimelogSubmit, extractTimelogDraft
- Add imports in server-sdk.ts
- Remove original definitions
- Run: `bun run server-sdk.ts` - verify starts
- **Run Test Suite 4: Timelog Flow**

### 17. Extract AI Visualization Handler (Phase 4.5)
- Create `lib/handlers/ai-viz.ts` with handleVisualizationRequest
- Add import in server-sdk.ts
- Remove original definition

### 18. Create Handlers Index
- Create `lib/handlers/index.ts` with re-exports from all handler files
- Verify all handlers properly exported

### 19. Final Cleanup and Verification
- Remove all extracted code from server-sdk.ts (should be ~800-1000 lines remaining)
- Verify server-sdk.ts only contains: env setup, routing logic, server startup
- Run all 4 test suites
- Verify no console errors
- Count lines in server-sdk.ts (target: under 1000 lines)

## Testing Strategy

### Per-Extraction Tests
After each file extraction:
1. `bun run server-sdk.ts` - server should start without errors
2. No TypeScript/import errors in console
3. Process should not crash on startup

### Phase Tests (Browser)
Use `specs/REFACTOR-BROWSER-TESTS.md` procedures:

**After Phase 3 (Agents):**
- Test Suite 1: Status Flow
  - December query recognizes past tense
  - Relative time queries work (last 3 months)
  - Q4 query interprets correctly
  - LLM fallback for complex queries

**After Phase 4.2 (Chart Handler):**
- Test Suite 2: Chart Flow
  - Hours by week chart renders
  - Hours by task chart renders

**After Phase 4.3 (Project Handler):**
- Test Suite 3: Project Flow
  - Simple project creation shows draft cards
  - Adding tasks to phases works

**After Phase 4.4 (Timelog Handler):**
- Test Suite 4: Timelog Flow
  - Simple time entry creates draft
  - Entry with description parses correctly

### Rollback Strategy
- Commit after each successful extraction
- If extraction breaks functionality: `git checkout -- <file>`
- Keep commits atomic (one extraction per commit)

## Acceptance Criteria

1. **Modular Structure:** All code extracted into `lib/` subdirectories matching target structure
2. **Server Starts:** `bun run server-sdk.ts` starts without errors
3. **Status Flow Works:** All Test Suite 1 tests pass (date parsing, agent responses)
4. **Chart Flow Works:** All Test Suite 2 tests pass (chart generation)
5. **Project Flow Works:** All Test Suite 3 tests pass (draft cards, tasklists)
6. **Timelog Flow Works:** All Test Suite 4 tests pass (time entry drafts)
7. **Reduced Main File:** server-sdk.ts under 1000 lines (target: ~800)
8. **No Console Errors:** Browser DevTools shows no runtime errors
9. **No Functionality Loss:** All existing features work identically to before refactoring

## Validation Commands

Execute these commands to validate the task is complete:

```bash
# Start backend (should start without errors)
cd apps/teamwork_backend && bun run server-sdk.ts &
sleep 3
curl -s http://localhost:3051/health | grep -q "ok" && echo "Health check: PASS" || echo "Health check: FAIL"

# Count lines in refactored server-sdk.ts (should be under 1000)
wc -l apps/teamwork_backend/server-sdk.ts

# Verify directory structure exists
ls -la apps/teamwork_backend/lib/utils/
ls -la apps/teamwork_backend/lib/mcp/
ls -la apps/teamwork_backend/lib/agents/
ls -la apps/teamwork_backend/lib/handlers/

# Verify all index files export correctly
cat apps/teamwork_backend/lib/utils/index.ts
cat apps/teamwork_backend/lib/agents/index.ts
cat apps/teamwork_backend/lib/handlers/index.ts

# Stop test server
kill %1
```

## Notes

### Bun-Specific Requirements
- Use `.ts` extension in all import paths (Bun requirement)
- Use `import type` for type-only imports to avoid circular dependency issues
- Dynamic imports are supported and used for Agent SDK

### Dependency Injection Pattern
The spec uses dependency injection for shared state:
- `query` - SDK query function (initialized at startup)
- `claudeCodePath` - Path to Claude Code executable
- `teamworkMcpServer` - MCP server instance
- `agentSdkAvailable` - Boolean flag for SDK availability

These are passed as parameters to extracted functions rather than using module-level globals.

### Shared Types
If circular dependencies arise, extract shared types (like DateRange) to a separate `types.ts` file that both modules can import.

### Port Configuration
- Backend: 3051
- Frontend: 5175
