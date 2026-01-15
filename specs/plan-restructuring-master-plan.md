# Plan: Teamwork App Restructuring - Master Plan

## Metadata
adw_id: `restructuring-master-plan`
prompt: `Restructure app for extensibility, create baseline project template, modularize server-sdk`
task_type: refactor
complexity: complex

## Task Description
This is a comprehensive restructuring of the Teamwork AI assistant application to achieve three primary goals:

1. **Make the app extensible** - Easy to create new modes and data display options ("skins")
2. **Create a baseline project template** - Reusable foundation for similar AI chat + data display apps
3. **Modularize the server-sdk** - Break down the 3538 LOC monolith into maintainable components

The project currently has a well-working "create project mode" that uses progressive streaming with JSON Lines to update the UI in real-time as the AI thinks. This pattern should become the standard for all modes.

## Objective
When this plan is complete:
- All chat modes will use the progressive streaming pattern (like project creation mode)
- New modes can be added by implementing a standard interface + skill file
- The server-sdk will be split into ~15-20 focused files
- A clean baseline project template will exist for creating similar apps
- The old server-sdk.ts will be preserved as backup/reference

## Problem Statement
The current architecture has several issues:

1. **server-sdk.ts is a 112KB monolith** containing all backend logic in one file
2. **Mode-specific logic is scattered** across frontend components
3. **No standardized pattern** for adding new modes or data displays
4. **Previous refactoring attempt failed** because changes were too aggressive
5. **Difficult to use as template** for new projects due to tight coupling

## Solution Approach

### Strategic Decision: Phased Incremental Refactoring

Given the complexity and previous failed refactoring, we will use a **phased, incremental approach**:

1. **Never break what's working** - Keep old files as backup until new versions are proven
2. **Migrate one component at a time** - Test thoroughly before proceeding
3. **Use adapter pattern** - New modules should work alongside old code initially
4. **Feature flags for rollout** - Toggle between old and new implementations

### Core Architectural Concepts

#### 1. Mode Plugin System
```typescript
interface ChatMode {
  id: string;
  name: string;
  icon: string;
  // Backend handler
  handler: ModeHandler;
  // Frontend renderer
  dataRenderer: React.ComponentType<DataRendererProps>;
  // Agent prompt/tools
  agentConfig: AgentConfig;
}
```

#### 2. Standardized Streaming Pattern
All modes will use the same SSE event structure:
```typescript
type SSEEvent =
  | { type: 'thinking'; content: string }
  | { type: 'data'; operation: 'init' | 'add' | 'update'; payload: any }
  | { type: 'result'; content: string }
  | { type: 'visualization'; spec: VizSpec }
  | { type: 'error'; message: string }
```

#### 3. Backend Module Structure
```
teamwork_backend/
├── server.ts              # Entry point (routing only)
├── agents/                # Agent definitions
├── handlers/              # Request handlers
├── tools/                 # MCP tool definitions
├── utils/                 # Shared utilities
├── modes/                 # Mode-specific logic
└── server-sdk.ts.bak      # Backup of original
```

## Relevant Files

### Backend (Primary Refactoring Target)
- `apps/teamwork_backend/server-sdk.ts` - **THE MONOLITH** (3538 LOC) - to be split
- `apps/teamwork_backend/types.ts` - Type definitions to expand
- `apps/teamwork_backend/services/agentService.ts` - Agent utilities (keep)
- `prompts/agents/timelog-agent.txt` - Agent prompt (migrate to mode config)
- `prompts/agents/card-agent.txt` - Agent prompt (migrate to mode config)
- `prompts/agents/visualization-agent.txt` - Agent prompt (migrate to mode config)

### Frontend (Secondary Refactoring)
- `apps/teamwork_frontend/App.tsx` - Main app (1878 LOC) - extract mode logic
- `apps/teamwork_frontend/services/claudeService.ts` - API calls (1028 LOC) - split
- `apps/teamwork_frontend/services/projectJsonParser.ts` - Parser pattern to generalize
- `apps/teamwork_frontend/components/DataDisplayPanel.tsx` - Renderer to make pluggable
- `apps/teamwork_frontend/types/conversation.ts` - Types to extend

### New Files to Create

#### Backend Structure
```
apps/teamwork_backend/
├── server.ts                          # New entry point
├── core/
│   ├── types.ts                       # Shared types
│   ├── streaming.ts                   # SSE utilities
│   └── validation.ts                  # Response validation
├── agents/
│   ├── base.ts                        # Base agent class
│   ├── chatAgent.ts                   # Chat/conversation agent
│   ├── visualizationAgent.ts          # Viz spec generator
│   └── registry.ts                    # Agent registry
├── handlers/
│   ├── base.ts                        # Base handler
│   ├── statusHandler.ts               # Status mode handler
│   ├── timelogHandler.ts              # Timelog mode handler
│   ├── projectHandler.ts              # Project mode handler
│   └── chartHandler.ts                # Chart request handler
├── tools/
│   ├── teamworkTools.ts               # Read-only Teamwork tools
│   ├── projectDraftTools.ts           # Project creation tools
│   └── timelogDraftTools.ts           # Timelog creation tools
├── modes/
│   ├── registry.ts                    # Mode registry
│   ├── status/                        # Status mode
│   │   ├── index.ts
│   │   ├── handler.ts
│   │   └── config.ts
│   ├── timelog/                       # Timelog mode
│   │   ├── index.ts
│   │   ├── handler.ts
│   │   └── config.ts
│   └── project/                       # Project mode
│       ├── index.ts
│       ├── handler.ts
│       └── config.ts
└── utils/
    ├── dateParser.ts                  # Natural language dates
    └── jsonExtractor.ts               # JSON extraction from responses
```

#### Frontend Structure
```
apps/teamwork_frontend/
├── modes/
│   ├── registry.ts                    # Mode registry
│   ├── types.ts                       # Mode interfaces
│   └── [mode]/
│       ├── index.ts
│       ├── DataRenderer.tsx           # Mode-specific renderer
│       └── config.ts                  # Mode configuration
├── services/
│   ├── streaming/
│   │   ├── client.ts                  # SSE client
│   │   ├── parser.ts                  # Generalized JSON Lines parser
│   │   └── accumulator.ts             # State accumulator pattern
│   └── api/
│       ├── status.ts
│       ├── timelog.ts
│       └── project.ts
└── hooks/
    ├── useMessageRouter.ts            # Message routing logic
    ├── useStreamingData.ts            # Streaming data hook
    └── useModeState.ts                # Mode state management
```

## Implementation Phases

### Phase 0: Preparation & Backup (0.5 days)
- Create backup of entire working state
- Document current behavior with tests
- Set up feature flags for migration

### Phase 1: Backend Foundation (2-3 days)
- Create new folder structure
- Extract utilities first (dateParser, jsonExtractor, streaming, validation)
- Create base classes and interfaces
- Keep server-sdk.ts working, import from new modules

### Phase 2: Backend Agent Extraction (2-3 days)
- Extract chatAgent.ts
- Extract visualizationAgent.ts
- Create agent registry
- Update server-sdk.ts to use new agents (with fallback)

### Phase 3: Backend Handler Extraction (2-3 days)
- Extract statusHandler.ts
- Extract timelogHandler.ts
- Extract projectHandler.ts
- Extract chartHandler.ts
- Create new server.ts entry point
- Run both servers in parallel for testing

### Phase 4: Backend Mode System (2 days)
- Create mode registry pattern
- Migrate handlers to mode plugins
- Test mode switching
- Deprecate old server-sdk.ts (keep as backup)

### Phase 5: Frontend Streaming Unification (2-3 days)
- Create generalized streaming parser
- Create StreamingDataProvider context
- Update all modes to use unified streaming

### Phase 6: Frontend Mode System (2-3 days)
- Create mode registry
- Extract mode-specific renderers
- Create ModeProvider context
- Update App.tsx to use mode system

### Phase 7: Baseline Project Template (2 days)
- Extract core patterns into template
- Create documentation
- Create skill templates
- Test with new sample project

### Phase 8: Claude Skills Creation (1-2 days)
- Create skill files for each mode
- Document skill structure
- Create skill creation guide

## Step by Step Tasks

**CRITICAL**: Each step includes required browser tests. Do NOT proceed to the next step until all tests pass.

### 1. Create Backup & Documentation
- [ ] Create `server-sdk.ts.bak` backup file
- [ ] Create `apps/teamwork_backend/ARCHITECTURE.md` documenting current behavior
- [ ] Add git tag `pre-restructuring-backup`
- [ ] Create feature flag system in `.env`
- [ ] **CAPTURE VISUAL BASELINES** for all modes (see Browser Testing section)

**Required Tests**: Full Regression Test (establishes baseline)
**Test Command**: Run all test IDs: login-001, status-001, timelog-001, project-001, switch-001, convo-001

---

### 2. Extract Backend Utilities
- [ ] Create `apps/teamwork_backend/core/` directory
- [ ] Extract `dateParser.ts` from server-sdk.ts (parseDateRange function)
  - **Test after**: Quick Smoke Test
- [ ] Extract `streaming.ts` (SSE response utilities)
  - **Test after**: status-001 (streaming must work)
- [ ] Extract `validation.ts` (response safety validation)
  - **Test after**: Quick Smoke Test
- [ ] Extract `jsonExtractor.ts` (JSON extraction from responses)
  - **Test after**: timelog-001, project-001 (JSON parsing critical)
- [ ] Update server-sdk.ts imports to use new utilities
- [ ] **GATE**: All endpoints must work

**Required Tests After Step**: status-001, timelog-001, project-001
**Rollback Trigger**: Any streaming or JSON parsing failure

---

### 3. Create Backend Type System
- [ ] Create `apps/teamwork_backend/core/types.ts` with:
  - SSEEvent types
  - AgentConfig interface
  - ModeHandler interface
  - ToolDefinition interface
- [ ] Export types from `apps/teamwork_backend/core/index.ts`
- [ ] Update existing types.ts to extend core types

**Required Tests After Step**: Quick Smoke Test (type changes shouldn't affect runtime)
**Note**: This is low-risk, primarily compile-time changes

---

### 4. Extract Agents
- [ ] Create `apps/teamwork_backend/agents/` directory
- [ ] Create `apps/teamwork_backend/agents/base.ts` with base agent class
- [ ] Extract `chatAgent.ts` (Chat Agent configuration + prompt)
  - **Test after**: status-001 (chat agent drives this)
- [ ] Extract `visualizationAgent.ts` (Viz Agent configuration + prompt)
  - **Test after**: status-001 (viz agent drives data display)
- [ ] Create `agents/registry.ts` for agent lookup
- [ ] Update server-sdk.ts to import agents
- [ ] **GATE**: Status endpoint fully functional

**Required Tests After Step**: status-001, convo-001
**Critical Assertions**:
- Thinking text streams
- Response text appears
- Visualization renders in right panel
- Follow-up questions work

---

### 5. Extract Tools
- [ ] Create `apps/teamwork_backend/tools/` directory
- [ ] Extract `teamworkTools.ts` (read-only MCP tools)
  - **Test after**: status-001 (uses Teamwork data)
- [ ] Extract `projectDraftTools.ts` (project creation tools)
  - **Test after**: project-001 (CRITICAL - progressive streaming)
- [ ] Extract `timelogDraftTools.ts` (timelog draft tools)
  - **Test after**: timelog-001 (draft generation)
- [ ] Create `tools/index.ts` for tool registration
- [ ] Update server-sdk.ts to import tools
- [ ] **GATE**: All tool-using endpoints work

**Required Tests After Step**: status-001, timelog-001, project-001
**Critical Assertions**:
- Project mode: Progressive build still works (NOT all at once)
- Timelog mode: Draft card appears with task matches
- Status mode: Data from Teamwork appears

---

### 6. Extract Handlers
- [ ] Create `apps/teamwork_backend/handlers/` directory
- [ ] Create `handlers/base.ts` with base handler class
- [ ] Extract `statusHandler.ts` (status mode logic)
  - **Test after**: status-001
- [ ] Extract `timelogHandler.ts` (timelog mode logic)
  - **Test after**: timelog-001
- [ ] Extract `projectHandler.ts` (project mode logic)
  - **Test after**: project-001
- [ ] Extract `chartHandler.ts` (chart generation logic)
  - **Test after**: status-001 (chart requests)
- [ ] Create `handlers/index.ts` for handler export
- [ ] Update server-sdk.ts to import handlers

**Required Tests After Step**: Full Regression Test
**Rollback Trigger**: Any mode completely broken

---

### 7. Create New Server Entry Point
- [ ] Create `apps/teamwork_backend/server.ts` (new entry point)
- [ ] Implement routing using extracted handlers
- [ ] Add middleware (CORS, auth, logging)
- [ ] Create environment variable `USE_NEW_SERVER=true|false`
- [ ] Test new server with all endpoints (flag on)
- [ ] Test old server still works (flag off)
- [ ] Run both servers in parallel for comparison testing

**Required Tests After Step**: Full Regression Test (TWICE - once per server)
**Parallel Testing Protocol**:
1. Run tests with `USE_NEW_SERVER=false` - all must pass
2. Run tests with `USE_NEW_SERVER=true` - all must pass
3. Compare response formats are identical

---

### 8. Create Mode Registry System
- [ ] Create `apps/teamwork_backend/modes/` directory
- [ ] Create `modes/types.ts` with Mode interface
- [ ] Create `modes/registry.ts` for mode registration
- [ ] Create `modes/status/` directory with mode config
  - **Test after**: status-001
- [ ] Create `modes/timelog/` directory with mode config
  - **Test after**: timelog-001
- [ ] Create `modes/project/` directory with mode config
  - **Test after**: project-001
- [ ] Update server.ts to use mode registry
- [ ] **GATE**: Mode switching works

**Required Tests After Step**: Full Regression Test + switch-001
**Critical Assertions**:
- Can switch between all modes
- Each mode behaves identically to before
- No state leaks between modes

---

### 9. Frontend Streaming Unification
- [ ] Create `apps/teamwork_frontend/services/streaming/` directory
- [ ] Create `client.ts` with unified SSE client
  - **Test after**: status-001 (basic streaming)
- [ ] Generalize `parser.ts` from projectJsonParser.ts
  - **Test after**: project-001 (CRITICAL - progressive parsing)
- [ ] Create `accumulator.ts` with state accumulator pattern
  - **Test after**: project-001, timelog-001
- [ ] Update claudeService.ts to use new streaming utilities
- [ ] **GATE**: All streaming endpoints work identically

**Required Tests After Step**: Full Regression Test
**Critical Assertions**:
- Project mode: Still builds progressively (visual confirmation)
- All modes: Streaming latency unchanged
- No "flash" of all content appearing at once

---

### 10. Frontend Mode System
- [ ] Create `apps/teamwork_frontend/modes/` directory
- [ ] Create `modes/types.ts` with frontend Mode interface
- [ ] Create `modes/registry.ts` for mode registration
- [ ] Create `modes/status/` with StatusDataRenderer
  - **Test after**: status-001
- [ ] Create `modes/timelog/` with TimelogDataRenderer
  - **Test after**: timelog-001
- [ ] Create `modes/project/` with ProjectDataRenderer
  - **Test after**: project-001
- [ ] Update DataDisplayPanel to use mode renderers
- [ ] Create ModeContext for state management

**Required Tests After Step**: Full Regression Test + switch-001
**Visual Comparison**: Compare screenshots to baselines

---

### 11. App.tsx Cleanup
- [ ] Extract message routing to `hooks/useMessageRouter.ts`
  - **Test after**: convo-001
- [ ] Extract project loading to `hooks/useProjectLoader.ts`
  - **Test after**: Quick Smoke Test
- [ ] Extract mode state to `contexts/ModeContext.tsx`
  - **Test after**: switch-001
- [ ] Reduce App.tsx to ~500 LOC of orchestration logic
- [ ] **GATE**: All functionality preserved

**Required Tests After Step**: Full Regression Test
**LOC Verification**: `wc -l apps/teamwork_frontend/App.tsx` < 600

---

### 12. Create Baseline Project Template
- [ ] Create `templates/baseline-ai-chat/` directory
- [ ] Copy core architecture (server, modes, streaming)
- [ ] Remove Teamwork-specific code
- [ ] Create generic example mode
- [ ] Create `templates/baseline-ai-chat/README.md` with setup guide
- [ ] Create `templates/baseline-ai-chat/docs/adding-modes.md`
- [ ] Test template creates working app

**Required Tests After Step**: Template-specific smoke test
**Template Test Protocol**:
1. Copy template to temp directory
2. Run `bun install`
3. Run `bun run dev`
4. Verify example mode works in browser

---

### 13. Create Claude Skills
- [ ] Create `.claude/skills/teamwork-mode-creation/SKILL.md`
- [ ] Document mode creation workflow
- [ ] Create example mode template
- [ ] Create `.claude/skills/data-display-creation/SKILL.md`
- [ ] Document data display creation workflow
- [ ] Test skills with Claude Code

**Required Tests After Step**: Manual skill invocation test
**Skill Test Protocol**:
1. Start new Claude Code session
2. Ask Claude to create a new mode using the skill
3. Verify skill provides correct guidance

---

### 14. Final Cleanup & Documentation
- [ ] Update main README.md with new architecture
- [ ] Create `docs/architecture.md` with diagrams
- [ ] Create `docs/extending.md` with extension guide
- [ ] Remove deprecated server-sdk.ts (keep .bak)
- [ ] **FINAL GATE**: Full Regression Test
- [ ] Create git tag `post-restructuring-v1`

**Required Tests After Step**: Full Regression Test (FINAL)
**Success Criteria**:
- All test IDs pass
- Visual comparison matches baselines (or documented intentional changes)
- No console errors
- Performance within 10% of baseline

## Testing Strategy

### Critical Rule: Test After Every Change

**MANDATORY**: After every small refactoring change, run the browser-based test for the affected mode(s) immediately. Do NOT batch multiple changes before testing. This catches breaking changes before they compound.

### Unit Tests
- Test each extracted utility function independently
- Test agent configurations produce valid prompts
- Test tool definitions match expected schemas
- Test handlers return correct SSE event types

### Integration Tests
- Test each mode end-to-end (send message, receive streaming response)
- Test draft creation and submission workflows
- Test conversation persistence across modes
- Test mode switching doesn't lose state

### Regression Tests
- Record current behavior for all endpoints
- Compare new implementation output against recorded baseline
- Flag any response format differences

### Feature Flag Testing
- Test with old implementation (flag off)
- Test with new implementation (flag on)
- Test rollback from new to old

### Performance Tests
- Measure streaming latency before/after
- Measure memory usage before/after
- Ensure no performance regression

---

## Browser-Based Testing with Claude in Chrome

### Overview

Each refactoring change must be validated using Claude in Chrome browser automation. This ensures the full user flow works end-to-end before proceeding to the next change.

### Visual Baselines Directory

Store baseline screenshots in:
```
specs/visual-baselines/
├── login-screen.png
├── status-mode/
│   ├── initial-state.png
│   ├── message-sent.png
│   ├── streaming-thinking.png
│   ├── response-complete.png
│   ├── data-display-charts.png
│   └── conversation-continued.png
├── timelog-mode/
│   ├── initial-state.png
│   ├── draft-card-displayed.png
│   ├── draft-editable.png
│   └── submission-success.png
├── project-mode/
│   ├── initial-state.png
│   ├── streaming-project-build.png
│   ├── draft-card-complete.png
│   └── project-created-success.png
└── mode-switching/
    ├── status-to-timelog.png
    ├── timelog-to-project.png
    └── project-to-status.png
```

### Test Scenarios by Mode

---

#### MODE: Login Flow

**Test ID**: `login-001`
**Description**: User can log in via Supabase OAuth

**Steps**:
1. Navigate to app URL (http://localhost:5173)
2. Verify login screen displays
3. Click "Login with Google/GitHub" button
4. Complete OAuth flow
5. Verify redirect back to app
6. Verify user profile shows in header

**Expected Outcomes**:
| Step | Assertion | Visual Check |
|------|-----------|--------------|
| 2 | Login button visible | `login-screen.png` |
| 5 | URL changes to main app | No auth error |
| 6 | User avatar/name in header | Profile dropdown works |

**Failure Indicators**:
- Blank screen after OAuth
- "Unauthorized" error message
- Infinite loading spinner

---

#### MODE: Status/General Mode

**Test ID**: `status-001`
**Description**: User asks a status question, receives streaming response with visualizations

**Preconditions**:
- User logged in
- Project selected (AI workflow test)
- Status mode active (default)

**Test Message**: "How many hours did I log last week?"

**Steps**:
1. Verify status mode is active (button highlighted)
2. Type test message in chat input
3. Press Enter or click Send
4. Observe streaming "thinking" text appears
5. Observe response text appears in chat
6. Observe data display panel updates with visualization
7. Verify charts/cards render correctly
8. Send follow-up: "Show me a breakdown by task"
9. Verify data display updates with new visualization

**Expected Outcomes**:
| Step | Assertion | Visual Check |
|------|-----------|--------------|
| 1 | Status button has active state | Blue/highlighted |
| 3 | Input clears, processing indicator shows | Spinner or pulse |
| 4 | Thinking text streams in left panel | Gray italic text |
| 5 | Response appears as assistant message | Markdown formatted |
| 6 | Right panel shows summary + chart | `data-display-charts.png` |
| 7 | Bar/line chart renders with data | No empty state |
| 9 | Visualization changes to show task breakdown | Different chart |

**Data Display Assertions**:
```json
{
  "type": "status",
  "hasVisualization": true,
  "visualizationTypes": ["summary", "barChart"],
  "summaryMetrics": {
    "totalHours": "> 0",
    "entryCount": "> 0"
  }
}
```

**Failure Indicators**:
- No thinking text appears (streaming broken)
- Response appears all at once (not streaming)
- Data panel stays empty
- Chart shows "No data" state
- Console errors about SSE/parsing

---

#### MODE: Timelog Mode

**Test ID**: `timelog-001`
**Description**: User requests time logging, receives draft for review

**Preconditions**:
- User logged in
- Project selected with existing tasks
- Timelog mode active

**Test Message**: "Log 4 hours yesterday on API development"

**Steps**:
1. Click Timelog mode button in sidebar
2. Verify mode switches (button highlighted)
3. Type test message
4. Press Enter
5. Observe streaming thinking text
6. Observe TimelogDraftCard appears in right panel
7. Verify draft shows:
   - Matched task with confidence score
   - Hours: 4
   - Date: yesterday's date
   - Auto-generated comment
8. Edit the hours in draft card (change to 3.5)
9. Verify edit is reflected
10. Click "Submit" button
11. Verify success confirmation
12. Verify time entry created in conversation

**Expected Outcomes**:
| Step | Assertion | Visual Check |
|------|-----------|--------------|
| 2 | Timelog button active, others inactive | Mode switch visual |
| 5 | Thinking streams in chat | `timelog-mode/initial-state.png` |
| 6 | Draft card appears in right panel | `draft-card-displayed.png` |
| 7 | All draft fields populated | Task name, hours, date visible |
| 9 | Hours field shows 3.5 | Editable input works |
| 11 | Success toast/message appears | Green confirmation |

**Draft Card Assertions**:
```json
{
  "type": "timelog_draft",
  "entries": [
    {
      "taskId": "number",
      "taskName": "string containing 'API'",
      "hours": 4,
      "date": "YYYY-MM-DD (yesterday)",
      "confidence": "> 0.5",
      "comment": "non-empty string"
    }
  ],
  "isEditable": true,
  "submitEnabled": true
}
```

**Failure Indicators**:
- Draft card never appears
- Task matching returns empty
- Confidence score is 0 or missing
- Edit doesn't persist
- Submit button disabled
- 500 error on submit

---

#### MODE: Project Creation Mode

**Test ID**: `project-001`
**Description**: User creates a project, sees progressive draft building

**Preconditions**:
- User logged in
- Project mode active

**Test Message**: "Create a mobile app project with design, development, and testing phases. Include tasks for wireframes, UI design, frontend coding, backend API, unit tests, and QA testing."

**Steps**:
1. Click Project mode button
2. Verify mode active
3. Type test message
4. Press Enter
5. Observe streaming thinking text
6. **Critical**: Observe ProjectDraftCard building progressively:
   - First: Project name/description appears
   - Then: "Design" tasklist appears
   - Then: Wireframes task appears under Design
   - Then: UI Design task appears
   - Continue watching incremental updates
7. Verify final draft shows complete structure
8. Verify all tasklists have tasks
9. Click "Create Project" button
10. Verify creation success
11. Verify new project appears in project list

**Expected Outcomes**:
| Step | Assertion | Visual Check |
|------|-----------|--------------|
| 5 | Thinking streams | Agent planning visible |
| 6 | Draft card builds incrementally | `streaming-project-build.png` |
| 6a | Project header appears first | Name + description |
| 6b | Tasklists appear one by one | "Design", "Development", "Testing" |
| 6c | Tasks appear under tasklists | Indented under parent |
| 7 | Complete structure visible | `draft-card-complete.png` |
| 10 | Success message | Project ID returned |

**Progressive Build Timing Assertions**:
```json
{
  "streamingPattern": "progressive",
  "events": [
    { "type": "init_project", "timing": "< 3s" },
    { "type": "add_tasklist", "count": 3, "timing": "incremental" },
    { "type": "add_task", "count": ">= 6", "timing": "incremental" }
  ],
  "totalBuildTime": "< 60s",
  "visualUpdatesPerSecond": "> 0.5"
}
```

**Draft Card Structure Assertions**:
```json
{
  "type": "project_draft",
  "project": {
    "name": "contains 'mobile' or 'app'",
    "description": "non-empty"
  },
  "tasklists": [
    { "name": "Design", "taskCount": ">= 2" },
    { "name": "Development", "taskCount": ">= 2" },
    { "name": "Testing", "taskCount": ">= 2" }
  ],
  "isEditable": true,
  "createEnabled": true
}
```

**Failure Indicators**:
- Draft card appears all at once (not progressive)
- Empty tasklists
- Missing tasks
- JSON parsing errors in console
- Streaming stops mid-build
- Create button disabled

---

#### MODE: Mode Switching

**Test ID**: `switch-001`
**Description**: User can switch modes without losing context

**Steps**:
1. Start in Status mode
2. Send a message, get response
3. Switch to Timelog mode
4. Verify chat clears or mode indicator changes
5. Switch back to Status mode
6. Verify previous conversation accessible (if persistent)
7. Switch to Project mode
8. Verify clean state for project creation

**Expected Outcomes**:
| Step | Assertion |
|------|-----------|
| 3 | Mode indicator updates |
| 4 | Right panel changes to timelog context |
| 6 | Can load previous status conversation |
| 8 | Project draft area is empty/ready |

---

#### MODE: Conversation Continuation

**Test ID**: `convo-001`
**Description**: Multi-turn conversation maintains context

**Preconditions**: Status mode active

**Conversation Flow**:
1. "How many hours did I log this month?"
2. Wait for response
3. "What about last month?"
4. Verify response compares or references previous context
5. "Show that as a bar chart"
6. Verify visualization updates

**Expected Outcomes**:
| Turn | Assertion |
|------|-----------|
| 1 | Response includes this month's hours |
| 3 | Response acknowledges "last month" without needing full context |
| 5 | Bar chart appears showing last month's data |

---

### Browser Test Execution Protocol

**Before Each Refactoring Change**:
1. Note which mode(s) the change affects
2. Identify which test IDs apply

**After Each Refactoring Change**:
1. Start the development server (`bun run dev`)
2. Open Chrome, navigate to app
3. Execute applicable test scenarios
4. Document any failures immediately
5. If ANY test fails: **STOP** and fix before continuing

**Test Recording** (optional but recommended):
- Use `gif_creator` to record test execution
- Save recordings in `specs/test-recordings/`
- Naming: `{test-id}-{date}-{pass|fail}.gif`

### Quick Smoke Test

For very small changes, run this abbreviated test:

```
1. App loads without console errors
2. Can select each mode
3. Can type and send a message
4. Response streams in
5. Data display shows something
```

Time: ~2 minutes

### Full Regression Test

Run before merging any phase:

```
1. Login flow (login-001)
2. Status mode full test (status-001)
3. Timelog mode full test (timelog-001)
4. Project mode full test (project-001)
5. Mode switching (switch-001)
6. Conversation continuation (convo-001)
```

Time: ~15-20 minutes

---

## Capturing Visual Baselines

**Before starting any refactoring**:

1. Run the app in its current working state
2. Execute each test scenario
3. At each checkpoint, take a screenshot using Claude in Chrome:
   ```
   action: screenshot
   ```
4. Save screenshots to `specs/visual-baselines/` with descriptive names
5. Commit baselines to git with tag `visual-baseline-v1`

**Baseline Update Protocol**:
- Only update baselines when intentionally changing UI
- Document why baseline changed in commit message
- Never update baseline to "fix" a failing visual test

---

## Claude in Chrome Test Execution Workflow

### Setup (One-time)

1. Ensure Claude in Chrome extension is installed
2. Create MCP tab group for testing
3. Bookmark the local app URL: `http://localhost:5173`

### Per-Change Test Workflow

After making a code change:

```
Step 1: Start servers
  - Terminal 1: cd apps/teamwork_backend && bun run server-sdk.ts
  - Terminal 2: cd apps/teamwork_frontend && bun run dev

Step 2: Get browser context
  - Use: tabs_context_mcp to get available tabs
  - Create new tab if needed: tabs_create_mcp

Step 3: Navigate to app
  - Use: navigate with url="http://localhost:5173"

Step 4: Execute test scenario
  - Use read_page to verify UI state
  - Use find to locate elements
  - Use form_input to type messages
  - Use computer with action="left_click" for buttons
  - Use computer with action="screenshot" at checkpoints

Step 5: Verify outcomes
  - Compare screenshots to baselines
  - Check for expected elements
  - Verify no console errors with read_console_messages
```

### Example: Running status-001 Test

```typescript
// 1. Navigate to app
navigate({ url: "http://localhost:5173", tabId })

// 2. Wait for load
computer({ action: "wait", duration: 2, tabId })

// 3. Screenshot: Initial state
computer({ action: "screenshot", tabId })

// 4. Find chat input
find({ query: "chat input field", tabId })

// 5. Type test message
form_input({ ref: "ref_X", value: "How many hours did I log last week?", tabId })

// 6. Find and click send button
find({ query: "send button", tabId })
computer({ action: "left_click", ref: "ref_Y", tabId })

// 7. Wait for streaming response
computer({ action: "wait", duration: 10, tabId })

// 8. Screenshot: Response complete
computer({ action: "screenshot", tabId })

// 9. Read page to verify data display
read_page({ tabId, filter: "all" })

// 10. Check for console errors
read_console_messages({ tabId, onlyErrors: true })
```

### Automated Test Recording

For critical tests, record GIF of full flow:

```typescript
// Start recording
gif_creator({ action: "start_recording", tabId })

// Execute test steps...

// Stop and export
gif_creator({ action: "stop_recording", tabId })
gif_creator({
  action: "export",
  tabId,
  filename: "status-001-test.gif",
  download: true
})
```

### Quick Validation Checklist

Use this checklist after each small change:

```markdown
## Quick Validation ✓

- [ ] App loads (no white screen)
- [ ] No console errors on load
- [ ] Can see mode selector buttons
- [ ] Can type in chat input
- [ ] Can click send button
- [ ] Response appears (streaming)
- [ ] Data display panel updates
```

### Failure Response Protocol

If a test fails:

1. **STOP** - Do not make more changes
2. **Screenshot** the failure state
3. **Check console** for errors
4. **Compare** against baseline screenshot
5. **Identify** which change broke it
6. **Revert** the breaking change
7. **Re-test** to confirm fix
8. **Then** attempt change differently

## Acceptance Criteria

### Functional Requirements
1. **All existing functionality works** - No regression in current features
2. **All modes use streaming pattern** - Like project creation mode (progressive updates)
3. **New mode can be added in <1 hour** - Following documented pattern
4. **Baseline template creates working app** - Under 10 minutes setup

### Code Quality Requirements
5. **server-sdk.ts split into <20 files** - Each <300 LOC
6. **App.tsx reduced to <600 LOC** - Mode logic extracted
7. **Claude skills documented** - For mode and display creation

### Testing Requirements
8. **Visual baselines captured** - All modes have baseline screenshots
9. **All browser tests pass** - login-001, status-001, timelog-001, project-001, switch-001, convo-001
10. **No console errors** - Clean browser console after each mode operation
11. **Progressive streaming verified** - Project mode must NOT show all-at-once updates

### Performance Requirements
12. **Streaming latency unchanged** - Within 10% of baseline
13. **No memory leaks** - Repeated mode switches don't increase memory

## Validation Commands

Execute these commands to validate the task is complete:

```bash
# 1. Verify new server starts
cd apps/teamwork_backend && bun run server.ts

# 2. Verify all endpoints respond
curl http://localhost:3051/api/health
curl -X POST http://localhost:3051/api/status -H "Content-Type: application/json" -d '{"message":"test","projectId":805682}'

# 3. Run type checking
cd apps/teamwork_backend && bun run typecheck
cd apps/teamwork_frontend && bun run typecheck

# 4. Verify file sizes
wc -l apps/teamwork_backend/server.ts        # Should be <200 LOC
wc -l apps/teamwork_backend/handlers/*.ts    # Each <300 LOC
wc -l apps/teamwork_frontend/App.tsx         # Should be <600 LOC

# 5. Verify mode count
ls -la apps/teamwork_backend/modes/          # Should have status/, timelog/, project/

# 6. Run tests
cd apps/teamwork_backend && bun test
cd apps/teamwork_frontend && bun test

# 7. Verify baseline template
ls -la templates/baseline-ai-chat/           # Should exist with README
```

## Notes

### Dependencies to Consider
- Claude Agent SDK version compatibility
- Bun runtime specifics (not Node.js)
- SSE streaming implementation differences
- Supabase client in frontend

### Risk Mitigation
- **Risk**: Breaking streaming during refactor
  - **Mitigation**: Extract streaming utilities first, test extensively

- **Risk**: Mode state desync between frontend/backend
  - **Mitigation**: Create shared type definitions, validate at boundaries

- **Risk**: Performance regression
  - **Mitigation**: Profile before/after, use feature flags for rollback

### Recommended Order
Due to the previous failed refactoring attempt, we recommend:

1. **Start with backend utilities** - Lowest risk, highest reuse
2. **Then extract agents** - Self-contained, easy to test
3. **Then extract tools** - Depend on utilities
4. **Then extract handlers** - Depend on agents + tools
5. **Then create mode system** - Orchestrates everything
6. **Then frontend** - After backend is stable
7. **Then baseline template** - After patterns are proven

### Implementation Notes
- Use `export type` for type-only exports (better tree-shaking)
- Use `const enum` for string unions (compile-time only)
- Prefer barrel exports (`index.ts`) for clean imports
- Keep server-sdk.ts.bak for emergency rollback

---

## Sub-Plan Links

This master plan spawns these detailed sub-plans:

1. `plan-restructuring-phase1-backend-foundation.md` - Backend utilities and types
2. `plan-restructuring-phase2-backend-agents.md` - Agent extraction
3. `plan-restructuring-phase3-backend-handlers.md` - Handler extraction
4. `plan-restructuring-phase4-backend-modes.md` - Mode system creation
5. `plan-restructuring-phase5-frontend-streaming.md` - Frontend streaming
6. `plan-restructuring-phase6-frontend-modes.md` - Frontend mode system
7. `plan-restructuring-phase7-baseline-template.md` - Template creation
8. `plan-restructuring-phase8-claude-skills.md` - Skill documentation

Execute plans in order. Each plan is independent and should be fully tested before proceeding to the next.
