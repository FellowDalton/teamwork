---
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, TodoWrite
description: Self-improve websocket expertise by validating against codebase
argument-hint: [check_git_diff (bool)] [focus_area (optional)]
---

# Purpose

Maintain websocket expertise accuracy by comparing against actual implementation.

## Variables

CHECK_GIT_DIFF: $1 default to false if not specified
FOCUS_AREA: $2 default to empty string
EXPERTISE_FILE: .claude/commands/experts/websocket/expertise.yaml
EXPERTISE_DIR: .claude/commands/experts/websocket
JOURNAL_FILE: .claude/commands/experts/websocket/expertise.learnings.jsonl
MAX_LINES: 1000

## Instructions

- This is a self-improvement workflow to keep websocket expertise synchronized with the actual codebase
- Think of the expertise file as your **mental model** and memory reference for all websocket-related functionality
- Always validate expertise against real implementation, not assumptions
- If FOCUS_AREA is provided, prioritize validation and updates for that specific area
- Maintain the YAML structure of the expertise file
- Enforce strict line limit of MAX_LINES maximum
- Prioritize actionable, high-value expertise over verbose documentation
- Be thorough in validation but concise in documentation
- Write CLEARLY and CONCISELY for future engineers

## Workflow

### 0. Detect Worktree Mode

Run the following to determine if we are in a git worktree:

```bash
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
```

If `GIT_DIR` and `GIT_COMMON_DIR` are different paths, we are in a **worktree** — use **Journal Mode** (steps 5J, skip 6, skip 7).

If they are the same, we are in the **main repo** — use **Direct Mode** (steps 5, 6, 7 as normal).

Also parse the current branch for track/story context:
```bash
BRANCH=$(git branch --show-current)
```
Extract `track` and `story` from the branch name if it follows the pattern `track-{id}/{story-slug}` or similar. Otherwise set both to `"unknown"`.

### 1. Check Git Diff (Conditional)

- If CHECK_GIT_DIFF is "true", run `git diff` to identify recent changes
- If changes detected, note them for targeted validation
- If CHECK_GIT_DIFF is "false", skip this step

### 2. Read Current Expertise

- Read the entire EXPERTISE_FILE
- Identify key sections
- Note any areas that seem outdated or incomplete

### 3. Validate Against Codebase

- Read key implementation files documented in expertise
- Use Grep to search for patterns
- Compare documented expertise against actual code

### 4. Identify Discrepancies

- List all differences found
- For each discrepancy, note the section name and a concise description

### 5. Update Expertise File (Direct Mode only)

- Remedy all identified discrepancies
- Maintain YAML structure and formatting

### 5J. Append to Learnings Journal (Worktree/Journal Mode only)

Instead of editing EXPERTISE_FILE directly, append one JSONL entry per learning to JOURNAL_FILE.

Each line must be valid JSON with this schema:
```json
{"ts":"ISO-8601-timestamp","expert":"websocket","track":"<track-id>","story":"<story-slug>","type":"update|add|remove","section":"<yaml-section-name>","description":"<what changed and why>","content":"<the actual YAML snippet or value to add/change/remove>"}
```

- `ts`: current UTC timestamp in ISO-8601 format
- `expert`: the expert name (`websocket`)
- `track`: parsed from branch name, or `"unknown"`
- `story`: parsed from branch name, or `"unknown"`
- `type`: `"add"` for new entries, `"update"` for changes to existing, `"remove"` for deletions
- `section`: the top-level YAML section this learning belongs to
- `description`: human-readable summary of what changed
- `content`: the actual YAML content to apply (for `"remove"`, describe what to remove)

Use `Write` tool to append (or create) the file. If the file already exists, read it first and append new entries.

After writing, skip steps 6 and 7 — go directly to Report.

### 6. Enforce Line Limit (Direct Mode only)

- Run: `wc -l EXPERTISE_FILE`
- If line count > MAX_LINES, trim least critical information
- REPEAT until line count ≤ MAX_LINES

### 7. Validation Check (Direct Mode only)

- Read the updated EXPERTISE_FILE
- Validate YAML syntax: `python3 -c "import yaml; yaml.safe_load(open('EXPERTISE_FILE'))"`

## Report

### Summary
- Whether git diff was checked
- Focus area (if any)
- Mode used: **Direct** or **Journal** (worktree)
- Total discrepancies found and remedied
- Final line count vs MAX_LINES (Direct Mode) or number of journal entries written (Journal Mode)

### Discrepancies Found
- What was incorrect/missing/outdated
- How it was remedied

### Updates Made
- Added sections/information
- Updated sections/information
- Removed sections/information

### Validation Results
- Confirm all critical expertise is present
- Confirm line count is within limit (Direct Mode) or journal entries written successfully (Journal Mode)
