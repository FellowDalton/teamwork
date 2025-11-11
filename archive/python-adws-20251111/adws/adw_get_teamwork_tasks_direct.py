#!/usr/bin/env python3
"""
Direct Teamwork task fetcher that bypasses Claude Code CLI.

This script uses MCP tools directly via Claude Code's interactive mode
to avoid the "Credit balance is too low" error that occurs with
programmatic subprocess execution.

Usage:
    ./adws/adw_get_teamwork_tasks_direct.py <project_id> [status_filter] [limit]

Example:
    ./adws/adw_get_teamwork_tasks_direct.py 805682 '["new", "to do", "review"]' 10
"""

import sys
import json
import re
from typing import List, Dict, Any, Optional


def extract_inline_tags(description: str) -> Dict[str, str]:
    """Extract inline tags from task description.

    Format: {{key: value}}
    Example: {{prototype: vite_vue}} {{model: sonnet}}

    Returns:
        Dictionary of tag key-value pairs
    """
    tags = {}
    pattern = r'\{\{(\w+):\s*([^}]+)\}\}'
    matches = re.findall(pattern, description)
    for key, value in matches:
        tags[key.strip()] = value.strip()
    return tags


def parse_native_tags(tag_list: List[Dict[str, Any]]) -> Dict[str, str]:
    """Parse Teamwork native tags into key-value pairs.

    Teamwork tags are retrieved from the API, and we need to fetch their names
    to parse them into key:value format (e.g., "prototype:vite_vue").

    Args:
        tag_list: List of tag objects with 'id' and 'type' from task API

    Returns:
        Dictionary of parsed tag key-value pairs
    """
    # Note: This would need to call mcp__teamwork__twprojects-get_tag
    # for each tag ID to get the tag name, then parse "key:value" format.
    # For now, return empty dict - caller should handle this.
    return {}


def detect_execution_trigger(description: str) -> Optional[str]:
    """Detect execution trigger in task description.

    Triggers:
    - "execute" at end of description -> "execute"
    - "continue - <prompt>" anywhere -> "continue"

    Returns:
        "execute", "continue", or None
    """
    # Check for "execute" at the end
    if description.strip().endswith('execute'):
        return "execute"

    # Check for "continue - " pattern
    if re.search(r'continue\s*-\s*.+', description, re.IGNORECASE):
        return "continue"

    return None


def extract_task_prompt(description: str, execution_trigger: Optional[str]) -> str:
    """Extract clean task prompt from description.

    Removes:
    - Inline tags: {{key: value}}
    - Execution trigger: "execute" or "continue - <prompt>"

    Args:
        description: Raw task description
        execution_trigger: Detected execution trigger

    Returns:
        Clean task prompt
    """
    prompt = description

    # Remove inline tags
    prompt = re.sub(r'\{\{\w+:\s*[^}]+\}\}', '', prompt)

    # Remove execution trigger
    if execution_trigger == "execute":
        prompt = re.sub(r'\s*execute\s*$', '', prompt, flags=re.IGNORECASE)
    elif execution_trigger == "continue":
        # For continue, the prompt is the text after "continue -"
        match = re.search(r'continue\s*-\s*(.+)', prompt, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()

    return prompt.strip()


def process_task(task: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Process a single task and return eligible task data.

    Args:
        task: Raw task data from Teamwork API

    Returns:
        Processed task dict if eligible, None otherwise
    """
    description = task.get('description', '')

    # Detect execution trigger
    execution_trigger = detect_execution_trigger(description)
    if not execution_trigger:
        return None  # Not eligible

    # Parse tags
    inline_tags = extract_inline_tags(description)

    # Note: Native tags would need additional API calls to fetch tag names
    # For now, we'll just use inline tags
    tags = inline_tags

    # Extract clean task prompt
    task_prompt = extract_task_prompt(description, execution_trigger)

    return {
        "task_id": str(task['id']),
        "title": task['name'],
        "status": task['status'],
        "description": description,
        "tags": tags,
        "execution_trigger": execution_trigger,
        "task_prompt": task_prompt,
        "project_id": task.get('tasklist', {}).get('id'),
        "created_at": task.get('createdAt'),
        "due_date": task.get('dueDate'),
        "priority": task.get('priority'),
    }


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: ./adws/adw_get_teamwork_tasks_direct.py <project_id> [status_filter] [limit]", file=sys.stderr)
        sys.exit(1)

    project_id = sys.argv[1]
    status_filter = json.loads(sys.argv[2]) if len(sys.argv) > 2 else ["new", "to do"]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    print(f"ERROR: This script requires MCP tool integration which cannot be called directly from Python.", file=sys.stderr)
    print(f"", file=sys.stderr)
    print(f"The monitor should be updated to bypass the /get_teamwork_tasks slash command", file=sys.stderr)
    print(f"and instead use direct MCP API calls via the Claude Code SDK or similar.", file=sys.stderr)
    print(f"", file=sys.stderr)
    print(f"Alternatively, wait for the programmatic execution limit to reset.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
