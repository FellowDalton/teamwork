# Streaming JSON Parser Approach

## Problem Statement

The tool-based progressive rendering approach sacrificed **planning quality** for **progressive UX**. Claude's one-tool-at-a-time constraint fragments its thinking, leading to inconsistent structures and sporadic subtask coverage.

**Goal:** Restore holistic planning quality while maintaining progressive UI rendering.

---

## Core Insight

These don't have to be mutually exclusive. Claude can output complete, well-planned JSON... and we parse it progressively as it streams.

---

## Comparison

| Aspect | Tool-Based (Current) | Streaming JSON Parser |
|--------|---------------------|----------------------|
| Planning quality | Fragmented (one tool at a time) | Holistic (thinks everything through) |
| Progressive UX | Yes (but forced) | Yes (natural streaming) |
| Token cost | Higher (tool schemas, responses) | Lower (just text) |
| Latency | Higher (MCP round-trips) | Lower (direct streaming) |
| Complexity | Server-side state, 6 tools | Client-side parser |
| Control | Explicit tool contracts | Parse what we get |

---

## Recommended Solution: JSON Lines (NDJSON)

Claude outputs **one complete JSON object per line**:

```
{"type": "project", "name": "MadRedder Platform", "description": "..."}
{"type": "tasklist", "id": "tl-1", "name": "Phase 1: Project Kickoff"}
{"type": "task", "id": "t-1", "tasklistId": "tl-1", "name": "Project kickoff meeting"}
{"type": "task", "id": "t-2", "tasklistId": "tl-1", "name": "Environment setup"}
{"type": "subtask", "taskId": "t-2", "name": "Install dependencies"}
{"type": "subtask", "taskId": "t-2", "name": "Configure IDE"}
{"type": "tasklist", "id": "tl-2", "name": "Phase 2: Design"}
{"type": "complete"}
```

### Why JSON Lines Wins

1. **Planning quality preserved**: Claude thinks through everything, then serializes line-by-line. Format doesn't constrain thinking.

2. **Dead simple parsing**: Split by newlines, JSON.parse each line.

3. **Natural progressive rendering**: Text streams character-by-character. As each line completes, parse and render.

4. **Faster than tools**: No MCP overhead, no round-trips, no server state.

5. **Cheaper**: No tool schemas bloating context, no tool response tokens.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Response                         │
│                                                             │
│  [Thinking text...]                                         │
│  {"type": "project", "name": "..."}                         │
│  {"type": "tasklist", ...}     ←── Each line streams in     │
│  {"type": "task", ...}                                      │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Streaming Parser                          │
│                                                             │
│  1. Accumulate text in buffer                               │
│  2. Split by newlines                                       │
│  3. For each complete line starting with '{'                │
│     → JSON.parse()                                          │
│     → Emit event based on type                              │
│  4. Keep incomplete lines in buffer                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    State Accumulator                        │
│                                                             │
│  project_init    → Initialize draft state                   │
│  tasklist        → Add to tasklists array                   │
│  task            → Add to appropriate tasklist              │
│  subtask         → Add to appropriate task                  │
│  complete        → Mark building done                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   React UI Updates                          │
│                                                             │
│  Each event triggers state update → component re-render     │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### JSON Line Schema

```typescript
type ProjectLine =
  | { type: 'project'; name: string; description?: string; startDate?: string; endDate?: string }
  | { type: 'tasklist'; id: string; name: string; description?: string }
  | { type: 'task'; id: string; tasklistId: string; name: string; description?: string; priority?: string }
  | { type: 'subtask'; taskId: string; name: string; description?: string }
  | { type: 'complete' };
```

### Parser Module (new file: `projectJsonParser.ts`)

```typescript
export class ProjectJsonParser {
  private buffer = '';
  private onEvent: (event: ProjectLine) => void;

  constructor(onEvent: (event: ProjectLine) => void) {
    this.onEvent = onEvent;
  }

  feed(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');

    // Keep last line in buffer (might be incomplete)
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const event = JSON.parse(trimmed) as ProjectLine;
          if (event.type) {
            this.onEvent(event);
          }
        } catch {
          // Not valid JSON, skip (might be thinking text)
        }
      }
    }
  }

  flush() {
    // Process any remaining buffer
    if (this.buffer.trim()) {
      this.feed('\n');
    }
  }
}
```

### System Prompt

```
When creating a project structure, think through the complete plan first, then output it as JSON Lines format.

Each line must be a complete, valid JSON object. Output in this order:

1. Project metadata:
   {"type": "project", "name": "...", "description": "..."}

2. All tasklists (phases):
   {"type": "tasklist", "id": "tl-1", "name": "Phase 1: ...", "description": "..."}
   {"type": "tasklist", "id": "tl-2", "name": "Phase 2: ...", "description": "..."}

3. Tasks grouped by tasklist:
   {"type": "task", "id": "t-1", "tasklistId": "tl-1", "name": "...", "description": "..."}
   {"type": "task", "id": "t-2", "tasklistId": "tl-1", "name": "...", "description": "..."}

4. Subtasks after their parent task:
   {"type": "subtask", "taskId": "t-2", "name": "..."}

5. Completion marker:
   {"type": "complete"}

IMPORTANT:
- Think through the ENTIRE project structure before outputting any JSON
- Each line must be valid JSON (no trailing commas, proper quotes)
- Use consistent ID schemes (tl-1, tl-2 for tasklists; t-1, t-2 for tasks)
- Every task that warrants breakdown should have subtasks
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/teamwork_frontend/services/projectJsonParser.ts` | New file - streaming JSON Lines parser |
| `apps/teamwork_frontend/services/claudeService.ts` | Integrate parser into stream processing |
| `apps/teamwork_frontend/server-sdk.ts` | Update system prompt, simplify/remove MCP tools |
| `apps/teamwork_frontend/App.tsx` | Wire parser events to state accumulator |

---

## Migration Path

1. **Keep existing tools as fallback** - Don't remove MCP tools immediately
2. **Add parser alongside** - Detect JSON Lines output, use parser
3. **Update system prompt** - Switch to JSON Lines format
4. **Test quality** - Verify planning consistency improves
5. **Remove tools later** - Once confident in new approach

---

## Alternative Approaches Considered

### Option A: Nested JSON with SAX Parser

Use a SAX-style streaming JSON parser (like `clarinet` or `oboe.js`) to parse nested JSON as it streams.

**Rejected because:** High complexity, difficult to handle partial strings and nesting depth correctly.

### Option C: Markdown + Embedded JSON

Claude writes markdown with embedded JSON blocks.

**Rejected because:** More complex parsing, mixed content handling adds edge cases.

---

## Status

**Spec created:** 2025-01-06
**Status:** Pending implementation
