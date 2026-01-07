# Three-Phase Project Planning Spec

## Problem Statement

The progressive tool-based project building approach has degraded planning quality:
- Inconsistent subtask coverage (some tasks get subtasks, others don't)
- Variable structure across different runs
- Less coherent overall planning

**Root cause:** The "one tool per message" constraint breaks Claude's natural holistic planning flow. It improvises as it goes rather than thinking through the complete structure first.

---

## Proposed Solution: Three-Phase Building

Instead of building items one-by-one as Claude thinks of them, enforce a structured three-phase approach:

### Phase 1: Skeleton (All Tasklists)
- Claude calls `add_tasklist_draft` for ALL phases before adding any tasks
- Forces Claude to map out the full project scope first
- User sees: All phase names appear

### Phase 2: Tasks (Fill Each Tasklist)
- Go through each tasklist sequentially
- Add all tasks for that tasklist before moving to the next
- User sees: Tasks populate each phase

### Phase 3: Subtasks (Add Detail)
- Go through tasks that need breakdown
- Add subtasks where appropriate
- User sees: Granular detail added

---

## Benefits

1. **Restores holistic thinking** - Phase 1 forces comprehensive scope planning
2. **Consistent coverage** - Phase 3 is explicitly for subtasks, won't be skipped randomly
3. **Mirrors natural project planning** - Top-down decomposition (scope → tasks → subtasks)
4. **Still progressive** - Users see things building in waves
5. **Easier to debug** - Know which phase caused issues

## Trade-offs

1. **"Wave" UX instead of smooth granular building**
2. **Less "magical" one-at-a-time appearance**

---

## Implementation

### System Prompt Update

Replace current tool instructions with:

```
When creating a project structure:

1. FIRST: Briefly describe your plan (2-3 sentences about the phases you'll create)

2. PHASE 1 - SKELETON: Call add_tasklist_draft for ALL phases before adding any tasks
   - Think through the complete project scope
   - Create all tasklists first

3. PHASE 2 - TASKS: Go through each tasklist and add all its tasks
   - Work through one tasklist at a time
   - Add all tasks for a tasklist before moving to the next

4. PHASE 3 - SUBTASKS: Go through tasks that need breakdown and add subtasks
   - Identify tasks that benefit from granular breakdown
   - Add subtasks consistently (don't skip randomly)

5. FINALIZE: Call finalize_project_draft when complete

This ensures consistent, comprehensive project structures.
```

### Optional Enhancement: Planning Output

Add a brief planning output at the start where Claude describes the overall structure before building:
- Serves as a "contract" Claude follows
- Provides visible feedback so users know what's coming
- Acts as checkpoint for Claude to commit to full scope

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/teamwork_frontend/server-sdk.ts` | Update system prompt with three-phase instructions |

---

## Status

**Spec created:** 2025-01-06
**Status:** Pending implementation
