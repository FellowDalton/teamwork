# Server-SDK Refactoring Specification

> **Companion file:** `specs/REFACTOR-BROWSER-TESTS.md` contains browser testing procedures.
> Run the relevant test suite after completing each phase.

## Overview

The `server-sdk.ts` file has grown to 3400+ lines and needs to be split into focused modules. This spec provides step-by-step instructions for safely extracting each module while maintaining functionality.

## Goals

1. Split monolithic `server-sdk.ts` into focused modules
2. Maintain all existing functionality
3. Test each extraction before proceeding
4. Keep the codebase maintainable

## Target Structure

```
apps/teamwork_backend/
├── server-sdk.ts              # Entry point: env setup, routing, server
├── config.ts                  # Configuration constants
├── lib/
│   ├── agents/
│   │   ├── index.ts           # Re-exports all agents
│   │   ├── agentic-status.ts  # runAgenticStatusAgent
│   │   ├── chat.ts            # runChatAgent
│   │   └── visualization.ts   # runVisualizationAgent
│   ├── handlers/
│   │   ├── index.ts           # Re-exports all handlers
│   │   ├── agent-chat.ts      # handleAgentChat (main status flow)
│   │   ├── chart.ts           # handleChartRequest
│   │   ├── project.ts         # handleProjectChat
│   │   ├── timelog.ts         # handleTimelogChat
│   │   └── ai-viz.ts          # handleVisualizationRequest
│   ├── mcp/
│   │   ├── index.ts           # MCP server factory
│   │   └── tools.ts           # Tool definitions
│   └── utils/
│       ├── index.ts           # Re-exports
│       ├── date-parsing.ts    # parseDateRange functions
│       ├── response.ts        # CORS, JSON response helpers
│       └── safety.ts          # Agent response validation
└── teamwork_api_client/       # (existing - don't modify)
```

## Shared Dependencies

These are initialized in `server-sdk.ts` and passed to modules:

| Dependency | Type | Used By |
|------------|------|---------|
| `teamwork` | TeamworkClient | MCP tools, handlers |
| `query` | Agent SDK function | All agents |
| `claudeCodePath` | string \| undefined | All agents |
| `teamworkMcpServer` | MCP Server | Agentic status agent |
| `agentSdkAvailable` | boolean | Date parsing, agents |

## Extraction Order

Extract in this order (least dependencies first):

1. `lib/utils/response.ts`
2. `lib/utils/safety.ts`
3. `config.ts`
4. `lib/utils/date-parsing.ts`
5. `lib/mcp/tools.ts` and `lib/mcp/index.ts`
6. `lib/agents/visualization.ts`
7. `lib/agents/chat.ts`
8. `lib/agents/agentic-status.ts`
9. `lib/handlers/chart.ts`
10. `lib/handlers/agent-chat.ts`
11. `lib/handlers/project.ts`
12. `lib/handlers/timelog.ts`
13. `lib/handlers/ai-viz.ts`

---

## Phase 1: Utils Extraction

### 1.1 Extract `lib/utils/response.ts`

**Source location in server-sdk.ts:** Lines ~1045-1061

**Create file:** `lib/utils/response.ts`

```typescript
// lib/utils/response.ts

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}
```

**Update server-sdk.ts:**
```typescript
import { corsHeaders, jsonResponse, errorResponse } from './lib/utils/response.ts';
```

**Test:** Run `bun run server-sdk.ts` - should start without errors.

---

### 1.2 Extract `lib/utils/safety.ts`

**Source location:** Lines ~701-740

**Create file:** `lib/utils/safety.ts`

```typescript
// lib/utils/safety.ts

export const BLOCKED_WRITE_TOOLS = [
  "log_time",
  "create_project",
  "create_task",
  "update_task",
  "delete_task",
  "create_timelog",
];

export function validateAgentResponse(response: string): {
  safe: boolean;
  warning?: string;
} {
  const dangerPatterns = [
    /teamwork\.timeEntries\.create/i,
    /teamwork\.projects\.create/i,
    /teamwork\.tasks\.create/i,
    /\.create\s*\(/i,
    /\.update\s*\(/i,
    /\.delete\s*\(/i,
  ];

  for (const pattern of dangerPatterns) {
    if (pattern.test(response)) {
      console.warn(
        "SAFETY WARNING: Agent response contains potential write operation:",
        pattern.source
      );
      return {
        safe: false,
        warning: `Blocked potential write operation matching: ${pattern.source}`,
      };
    }
  }

  return { safe: true };
}
```

**Update server-sdk.ts:**
```typescript
import { validateAgentResponse, BLOCKED_WRITE_TOOLS } from './lib/utils/safety.ts';
```

**Test:** Run `bun run server-sdk.ts` - should start without errors.

---

### 1.3 Extract `config.ts`

**Source location:** Lines ~652-662

**Create file:** `config.ts`

```typescript
// config.ts

export const PORT = parseInt(process.env.PORT || "3051");
export const TEAMWORK_API_URL = process.env.TEAMWORK_API_URL;
export const TEAMWORK_BEARER_TOKEN = process.env.TEAMWORK_BEARER_TOKEN;
export const DEFAULT_PROJECT_ID = parseInt(process.env.TEAMWORK_PROJECT_ID || "0");

export const ALLOWED_PROJECTS = [
  { id: 805682, name: "AI workflow test" },
  { id: 804926, name: "KiroViden - Klyngeplatform" },
];
```

**Update server-sdk.ts:**
```typescript
import { PORT, TEAMWORK_API_URL, TEAMWORK_BEARER_TOKEN, DEFAULT_PROJECT_ID, ALLOWED_PROJECTS } from './config.ts';
```

**Test:** Run `bun run server-sdk.ts` - should start without errors.

---

### 1.4 Extract `lib/utils/date-parsing.ts`

**Source location:** Lines ~106-291

**Create file:** `lib/utils/date-parsing.ts`

```typescript
// lib/utils/date-parsing.ts

import type { Options } from "@anthropic-ai/claude-agent-sdk";

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export function parseDateRangeFast(question: string): DateRange | null {
  // ... copy the entire function
}

export async function parseDateRangeWithLLM(
  question: string,
  query: any,
  claudeCodePath: string | undefined,
  agentSdkAvailable: boolean
): Promise<DateRange> {
  // ... copy the entire function
  // Note: query, claudeCodePath, agentSdkAvailable are now parameters
}

export async function parseDateRange(
  question: string,
  query: any,
  claudeCodePath: string | undefined,
  agentSdkAvailable: boolean
): Promise<DateRange> {
  const fastResult = parseDateRangeFast(question);
  if (fastResult) {
    console.log("Fast date parse:", fastResult);
    return fastResult;
  }

  console.log("Using LLM for date parsing:", question);
  return parseDateRangeWithLLM(question, query, claudeCodePath, agentSdkAvailable);
}
```

**Update server-sdk.ts:**
```typescript
import { parseDateRange, parseDateRangeFast, type DateRange } from './lib/utils/date-parsing.ts';

// Update calls to parseDateRange to pass dependencies:
const dateRange = await parseDateRange(prompt, query, claudeCodePath, agentSdkAvailable);
```

**Test:** Run `bun run server-sdk.ts` - should start without errors.

---

### 1.5 Create `lib/utils/index.ts`

```typescript
// lib/utils/index.ts

export * from './response.ts';
export * from './safety.ts';
export * from './date-parsing.ts';
```

**Phase 1 Complete** - Run `bun run server-sdk.ts` to verify. No browser tests needed yet (utils only).

---

## Phase 2: MCP Extraction

### 2.1 Extract `lib/mcp/tools.ts`

**Source location:** Lines ~747-1043

**Create file:** `lib/mcp/tools.ts`

```typescript
// lib/mcp/tools.ts

import { z } from "zod";
import type { TeamworkClient } from "../teamwork_api_client/index.ts";

export function createTeamworkTools(
  teamwork: TeamworkClient,
  tool: any,
  ALLOWED_PROJECTS: Array<{ id: number; name: string }>
) {
  return [
    tool(
      "test_connection",
      "Test if the MCP server is working.",
      {},
      async () => {
        console.log("test_connection called!");
        return {
          content: [{ type: "text", text: "MCP server is working!" }],
        };
      }
    ),

    tool(
      "get_time_entries",
      "Fetch time entries for a date range. Returns total hours, entry count, and entry details.",
      {
        startDate: z.string(),
        endDate: z.string(),
        projectId: z.string().optional(),
      },
      async ({ startDate, endDate, projectId }: { startDate: string; endDate: string; projectId?: string }) => {
        // ... copy the entire handler
      }
    ),

    // ... copy all other tools
  ];
}
```

### 2.2 Extract `lib/mcp/index.ts`

```typescript
// lib/mcp/index.ts

import type { TeamworkClient } from "../teamwork_api_client/index.ts";
import { createTeamworkTools } from "./tools.ts";

export function createTeamworkMcpServer(
  teamwork: TeamworkClient,
  createSdkMcpServer: any,
  tool: any,
  ALLOWED_PROJECTS: Array<{ id: number; name: string }>
) {
  const tools = createTeamworkTools(teamwork, tool, ALLOWED_PROJECTS);

  return createSdkMcpServer({
    name: "teamwork",
    tools,
  });
}

export type TeamworkMcpServer = ReturnType<typeof createTeamworkMcpServer>;
```

**Update server-sdk.ts:**
```typescript
import { createTeamworkMcpServer } from './lib/mcp/index.ts';

const teamworkMcpServer = createTeamworkMcpServer(
  teamwork,
  createSdkMcpServer,
  tool,
  ALLOWED_PROJECTS
);
```

**Test:** Run `bun run server-sdk.ts` - should start without errors.

**Phase 2 Complete** - No browser tests needed yet (MCP tools are internal).

---

## Phase 3: Agents Extraction

### 3.1 Extract `lib/agents/visualization.ts`

**Source location:** Lines ~293-400

**Create file:** `lib/agents/visualization.ts`

```typescript
// lib/agents/visualization.ts

import type { Options } from "@anthropic-ai/claude-agent-sdk";

interface VisualizationContext {
  question: string;
  data: any;
  periodLabel: string;
}

export async function runVisualizationAgent(
  context: VisualizationContext,
  query: any,
  claudeCodePath: string | undefined
): Promise<any | null> {
  // ... copy the entire function
  // Note: query and claudeCodePath are now parameters
}
```

### 3.2 Extract `lib/agents/chat.ts`

**Source location:** Lines ~519-628

**Create file:** `lib/agents/chat.ts`

```typescript
// lib/agents/chat.ts

import type { Options } from "@anthropic-ai/claude-agent-sdk";

interface ChatContext {
  question: string;
  data: any;
  periodLabel: string;
  projectName?: string;
}

export async function runChatAgent(
  context: ChatContext,
  onChunk: (text: string) => void,
  onThinking: ((text: string) => void) | undefined,
  query: any,
  claudeCodePath: string | undefined
): Promise<string> {
  // ... copy the entire function
}
```

### 3.3 Extract `lib/agents/agentic-status.ts`

**Source location:** Lines ~402-517

**Create file:** `lib/agents/agentic-status.ts`

```typescript
// lib/agents/agentic-status.ts

import type { Options } from "@anthropic-ai/claude-agent-sdk";

interface AgenticStatusContext {
  question: string;
  projectId?: number;
  projectName?: string;
}

export async function runAgenticStatusAgent(
  context: AgenticStatusContext,
  onThinking: ((text: string) => void) | undefined,
  onVisualization: ((spec: any) => void) | undefined,
  query: any,
  claudeCodePath: string | undefined,
  teamworkMcpServer: any
): Promise<{ text: string; visualizations: any[] }> {
  // ... copy the entire function
  // Note: query, claudeCodePath, teamworkMcpServer are now parameters
}
```

### 3.4 Create `lib/agents/index.ts`

```typescript
// lib/agents/index.ts

export * from './visualization.ts';
export * from './chat.ts';
export * from './agentic-status.ts';
```

**Test:** Run `bun run server-sdk.ts` - should start without errors.

**Phase 3 Complete** - Run **Test Suite 1: Status Flow** from `specs/REFACTOR-BROWSER-TESTS.md` to verify agents work correctly.

---

## Phase 4: Handlers Extraction

### 4.1 Extract `lib/handlers/agent-chat.ts`

**Source location:** Lines ~1063-1217

This is the main status flow handler. Extract it with all dependencies passed as parameters.

### 4.2 Extract remaining handlers

Follow the same pattern for:
- `lib/handlers/chart.ts` (handleChartRequest) → then run **Test Suite 2: Chart Flow**
- `lib/handlers/project.ts` (handleProjectChat) → then run **Test Suite 3: Project Flow**
- `lib/handlers/timelog.ts` (handleTimelogChat) → then run **Test Suite 4: Timelog Flow**
- `lib/handlers/ai-viz.ts` (handleVisualizationRequest)

**Phase 4 Complete** - Run **all Test Suites** from `specs/REFACTOR-BROWSER-TESTS.md` to verify full functionality.

---

## Testing Procedures

### After Each Extraction

1. **Compile check:**
   ```bash
   cd apps/teamwork_backend
   bun run server-sdk.ts &
   sleep 3
   kill %1
   ```
   Should start without syntax/import errors.

2. **Manual endpoint test** (if applicable)

### Browser Testing with Claude in Chrome

For each major flow, test via the frontend:

#### Test: Status Flow (after extracting agents + agent-chat handler)

```
1. Open browser to http://localhost:5175 (frontend)
2. Select a project from dropdown
3. Type: "How many hours were logged in December?"
4. Expected:
   - Should see "Analyzing your question..." init message
   - Should see thinking/streaming text
   - Should get a response about December 2025 hours
   - Should see visualization cards/charts
5. Type: "What about Q4?"
6. Expected:
   - Should correctly interpret Q4 as Oct-Dec 2025
   - Should return hours for that period
```

#### Test: Chart Flow (after extracting chart handler)

```
1. Open browser to http://localhost:5175
2. Select a project
3. Click a chart type button (e.g., "Hours by Week")
4. Expected:
   - Should see a line/bar chart appear
   - Data should be for last 90 days
```

#### Test: Project Creation Flow (after extracting project handler)

```
1. Open browser to http://localhost:5175
2. Switch to "Project" mode
3. Type: "Create a project for building a mobile app with 3 phases"
4. Expected:
   - Should see project draft cards appearing progressively
   - Should have tasklists for each phase
   - Should have tasks within tasklists
```

#### Test: Timelog Flow (after extracting timelog handler)

```
1. Open browser to http://localhost:5175
2. Switch to "Timelog" mode
3. Type: "Log 2 hours on task testing yesterday"
4. Expected:
   - Should see a timelog draft card
   - Should have correct date (yesterday)
   - Should have 2 hours
```

---

## Verification Checklist

After all extractions, verify:

- [ ] Server starts without errors
- [ ] Status flow works (natural language date queries)
- [ ] Chart generation works
- [ ] Project creation flow works
- [ ] Timelog flow works
- [ ] All API endpoints respond correctly
- [ ] No console errors in browser
- [ ] No runtime errors in server logs

---

## Rollback Strategy

If an extraction breaks something:

1. `git stash` or `git checkout -- <file>` to restore
2. Identify the issue (missing import, wrong parameter passing)
3. Fix and retry

Keep commits small (one extraction per commit) so rollback is easy.

---

## Notes for Implementation

1. **Bun imports:** Use `.ts` extension in imports (Bun requirement)
2. **Type imports:** Use `import type` for type-only imports
3. **Circular dependencies:** If A imports B and B imports A, extract shared types to a separate file
4. **Testing:** The frontend runs on port 5175, backend on 3051
5. **MCP Server state:** The MCP server has internal state - ensure it's created once and passed around

---

## Commands Reference

```bash
# Start backend
cd apps/teamwork_backend
bun run server-sdk.ts

# Start frontend (separate terminal)
cd apps/teamwork_frontend
bun run dev

# Check for TypeScript errors (informational only - Bun ignores many)
bun run tsc --noEmit

# Kill process on port 3051 if needed
lsof -ti:3051 | xargs kill -9
```
