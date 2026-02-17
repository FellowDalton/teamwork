---
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
description: Consolidate railway expertise learnings journal into expertise.yaml
---

# Purpose

Apply accumulated learnings from the JSONL journal into the railway expertise YAML file.
This is run after parallel worktree branches have merged, to consolidate all journal entries.

## Variables

EXPERTISE_FILE: .claude/commands/experts/railway/expertise.yaml
JOURNAL_FILE: .claude/commands/experts/railway/expertise.learnings.jsonl
MAX_LINES: 1000

## Instructions

- Read the journal file and apply learnings intelligently to the expertise YAML
- Group related learnings by section for efficient application
- Resolve conflicts between journal entries (later timestamps win)
- Maintain YAML structure and formatting
- Enforce the MAX_LINES limit after applying changes
- Clear the journal file after successful consolidation

## Workflow

### 1. Check for Journal Entries

- Read JOURNAL_FILE
- If empty or doesn't exist, report "nothing to consolidate" and exit
- Parse each line as JSON, collect all valid entries
- Report any malformed lines (skip them)

### 2. Read Current Expertise

- Read the entire EXPERTISE_FILE
- Parse YAML structure to understand current sections

### 3. Group and Deduplicate Learnings

- Group entries by `section`
- Within each section, sort by `ts` (timestamp) ascending
- If multiple entries target the same content, keep the latest
- Separate into: adds, updates, removes

### 4. Apply Learnings

For each section group:
- **add**: Insert new entries into the appropriate YAML section
- **update**: Replace or modify existing entries in the YAML
- **remove**: Delete entries as described

Use the `Edit` tool to make targeted changes to EXPERTISE_FILE.

### 5. Enforce Line Limit

- Run: `wc -l EXPERTISE_FILE`
- If line count > MAX_LINES, trim least critical information
- REPEAT until line count ≤ MAX_LINES

### 6. Validate YAML

- Validate syntax: `python3 -c "import yaml; yaml.safe_load(open('EXPERTISE_FILE'))"`
- If validation fails, revert the last change and try again

### 7. Clear Journal

- Truncate JOURNAL_FILE to empty (write empty string)
- This prevents re-processing on next run

## Report

### Summary
- Number of journal entries processed
- Entries by type (add/update/remove)
- Sections affected
- Final line count vs MAX_LINES

### Changes Applied
- What was added/updated/removed per section

### Validation
- YAML syntax check result
- Line count compliance
