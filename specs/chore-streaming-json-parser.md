# Chore: Implement Streaming JSON Parser for Project Creation

## Metadata
adw_id: `streaming-json-parser`
prompt: `@specs/streaming-json-parser-approach.md`

## Chore Description
Replace the current tool-based progressive rendering approach for project creation with a streaming JSON Lines (NDJSON) parser. The goal is to restore holistic planning quality (Claude thinks through the entire project first) while maintaining progressive UI rendering (items appear as they stream in line-by-line).

Currently, Claude outputs project drafts through tool calls (MCP), which fragments thinking into one-tool-at-a-time patterns. The new approach has Claude output complete JSON objects one per line, which are parsed progressively as they stream.

## Relevant Files
Use these files to complete the chore:

### Existing Files to Modify

- **`apps/teamwork_frontend/services/claudeService.ts`** - Contains `processAgentStream()` which handles SSE streaming from the backend. This is where the JSON Lines parser will be integrated to parse incoming project draft lines.

- **`apps/teamwork_frontend/server-sdk.ts`** - Backend server with agent streaming endpoints. Contains the system prompt for the project agent that needs to be updated to output JSON Lines format instead of using progressive draft tools.

- **`apps/teamwork_frontend/App.tsx`** - React app with state accumulator logic (`onProjectDraft`, `onProjectDraftUpdate`, `onProjectDraftComplete` handlers). These handlers need to be updated to process parsed JSON Line events instead of tool-based events.

- **`apps/teamwork_frontend/types/conversation.ts`** - Contains `ProjectDraftData`, `TasklistDraft`, `TaskDraft`, `SubtaskDraft`, and `ProjectDraftStreamEvent` types. May need new types for JSON Line events.

### New Files to Create

- **`apps/teamwork_frontend/services/projectJsonParser.ts`** - New streaming JSON Lines parser class that accumulates text in a buffer, splits by newlines, and emits parsed events for each complete JSON line.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Define JSON Line Schema Types
- Open `apps/teamwork_frontend/types/conversation.ts`
- Add a new `ProjectLine` discriminated union type at the end of the file:
  ```typescript
  export type ProjectLine =
    | { type: 'project'; name: string; description?: string; startDate?: string; endDate?: string }
    | { type: 'tasklist'; id: string; name: string; description?: string }
    | { type: 'task'; id: string; tasklistId: string; name: string; description?: string; priority?: string }
    | { type: 'subtask'; taskId: string; name: string; description?: string }
    | { type: 'complete' };
  ```
- Export the type

### 2. Create the Streaming JSON Parser Module
- Create new file `apps/teamwork_frontend/services/projectJsonParser.ts`
- Implement the `ProjectJsonParser` class as specified in the spec:
  - Constructor takes an `onEvent` callback that receives `ProjectLine` objects
  - `feed(chunk: string)` method accumulates text, splits by newlines, parses complete JSON lines
  - `flush()` method processes any remaining buffer content
  - Skip non-JSON lines (thinking text) gracefully
- Add state accumulator helper that converts JSON Line events into `ProjectDraftData`:
  - `project_init` → Initialize draft state
  - `tasklist` → Add to tasklists array
  - `task` → Add to appropriate tasklist's tasks array
  - `subtask` → Add to appropriate task's subtasks array
  - `complete` → Mark building done

### 3. Update Backend System Prompt for Project Agent
- Open `apps/teamwork_frontend/server-sdk.ts`
- Find the project agent system prompt (search for `runProjectAgent` or project creation prompt)
- Update the system prompt to instruct Claude to:
  - Think through the ENTIRE project structure before outputting
  - Output JSON Lines format (one JSON object per line)
  - Follow the ordering: project → tasklists → tasks → subtasks → complete
  - Use consistent ID schemes (tl-1, tl-2 for tasklists; t-1, t-2 for tasks)
- Keep existing MCP tools as fallback during transition (don't remove them yet)

### 4. Integrate Parser into Stream Processing
- Open `apps/teamwork_frontend/services/claudeService.ts`
- Import `ProjectJsonParser` and state accumulator from new module
- In `processAgentStream()` function:
  - Create a `ProjectJsonParser` instance when in project topic mode
  - Feed incoming text chunks to the parser
  - When parser emits events, convert them to existing event types (`onProjectDraft`, `onProjectDraftUpdate`, etc.)
  - Keep existing event handling for backward compatibility (detect format: JSON Lines vs tool-based)

### 5. Update React State Accumulator in App.tsx
- Open `apps/teamwork_frontend/App.tsx`
- Verify `onProjectDraft` and `onProjectDraftUpdate` handlers work with both:
  - New JSON Line events (from parser)
  - Legacy tool-based events (for fallback)
- The handlers should already be compatible since they just update state based on event type
- If needed, add format detection to handle both approaches gracefully

### 6. Add Format Detection for Migration
- In `processAgentStream()`, add logic to detect which format Claude is using:
  - If response starts with `{` and contains JSON Lines → use parser
  - If response uses SSE events like `project_draft_init` → use existing handlers
- This allows gradual migration without breaking existing functionality

### 7. Write Unit Tests for Parser
- Create `apps/teamwork_frontend/services/projectJsonParser.test.ts`
- Test cases:
  - Parsing complete JSON lines
  - Handling incomplete lines (buffering)
  - Skipping thinking text (non-JSON content)
  - Processing all event types (project, tasklist, task, subtask, complete)
  - Edge cases: empty lines, malformed JSON, interleaved text

### 8. Validate End-to-End Flow
- Start dev server: `cd apps/teamwork_frontend && bun run server-sdk.ts`
- Open browser to frontend
- Switch to PROJECT topic mode
- Enter a project description (e.g., "Create a mobile app development project")
- Verify:
  - Project draft card appears progressively
  - Tasklists populate as they stream in
  - Tasks appear under correct tasklists
  - Subtasks appear under correct tasks
  - Final draft is complete and submittable

## Validation Commands
Execute these commands to validate the chore is complete:

- `cd apps/teamwork_frontend && bun test services/projectJsonParser.test.ts` - Run unit tests for the new parser module
- `cd apps/teamwork_frontend && bunx tsc --noEmit` - Type check all TypeScript files including new types
- `cd apps/teamwork_frontend && bun run server-sdk.ts` - Start the server and manually test project creation flow
- Verify in browser: Create new project, observe progressive rendering, submit successfully

## Notes

### Migration Strategy
The spec recommends keeping existing tools as fallback:
1. Add parser alongside existing handlers
2. Detect JSON Lines output and use parser when present
3. Fall back to tool-based handling for non-JSON responses
4. Once confident, remove MCP tools in a future PR

### Benefits of JSON Lines
- **Planning quality**: Claude thinks holistically before outputting
- **Dead simple parsing**: Split by newlines, JSON.parse each
- **Lower latency**: No MCP round-trips, direct streaming
- **Lower cost**: No tool schemas in context, fewer tokens

### Potential Issues
- Claude might occasionally output invalid JSON lines - parser should handle gracefully
- Thinking text before JSON output needs to be skipped cleanly
- ID scheme must be consistent for tasklist/task/subtask references
