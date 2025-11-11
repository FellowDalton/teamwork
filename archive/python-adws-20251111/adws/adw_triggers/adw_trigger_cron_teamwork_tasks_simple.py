#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
#     "pydantic>=2.0.0",
# ]
# ///
"""
Simplified Teamwork task monitor that bypasses Claude Code CLI slash commands.

This version directly fetches tasks from Teamwork using MCP tools in the current
interactive session, avoiding the "Credit balance is too low" error from
programmatic subprocess execution.

Usage:
    ./adws/adw_triggers/adw_trigger_cron_teamwork_tasks_simple.py [--once] [--dry-run]
"""

import os
import sys
import json
import re
import logging
import time
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from adw_modules.data_models import TeamworkTask, TeamworkCronConfig
from adw_modules.agent import generate_short_id

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def extract_inline_tags(description: str) -> Dict[str, str]:
    """Extract inline tags from task description.

    Format: {{key: value}}
    Example: {{prototype: vite_vue}} {{model: sonnet}}
    """
    tags = {}
    pattern = r'\{\{(\w+):\s*([^}]+)\}\}'
    matches = re.findall(pattern, description)
    for key, value in matches:
        tags[key.strip()] = value.strip()
    return tags


def detect_execution_trigger(description: str) -> Optional[str]:
    """Detect execution trigger in task description."""
    if description.strip().endswith('execute'):
        return "execute"
    if re.search(r'continue\s*-\s*.+', description, re.IGNORECASE):
        return "continue"
    return None


def extract_task_prompt(description: str, execution_trigger: Optional[str]) -> str:
    """Extract clean task prompt from description."""
    prompt = description
    # Remove inline tags
    prompt = re.sub(r'\{\{\w+:\s*[^}]+\}\}', '', prompt)
    # Remove execution trigger
    if execution_trigger == "execute":
        prompt = re.sub(r'\s*execute\s*$', '', prompt, flags=re.IGNORECASE)
    elif execution_trigger == "continue":
        match = re.search(r'continue\s*-\s*(.+)', prompt, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()
    return prompt.strip()


def parse_native_tags(tags_list: List[Dict[str, Any]]) -> Dict[str, str]:
    """Parse native Teamwork tags from tag names.

    Since we don't have tag names in the task list response,
    this returns empty dict for now. The actual tag name fetching
    would require additional MCP calls.
    """
    # TODO: Implement if tag names are needed
    # Would need to call mcp__teamwork__twprojects-get_tag for each tag ID
    return {}


def make_worktree_name(task_description: str) -> str:
    """Generate a worktree name from task description."""
    # Take first 50 chars, convert to lowercase, replace non-alphanumeric with hyphens
    name = task_description[:50].lower()
    name = re.sub(r'[^a-z0-9]+', '-', name)
    name = name.strip('-')
    return f"proto-{name}" if name else f"proto-task-{generate_short_id()}"


def spawn_workflow(
    script_path: str,
    args: List[str],
    dry_run: bool = False
) -> bool:
    """Spawn a detached workflow subprocess."""

    if dry_run:
        logger.info(f"DRY RUN: Would spawn workflow: {script_path} {' '.join(args)}")
        return True

    try:
        # Spawn detached subprocess
        subprocess.Popen(
            [script_path] + args,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        logger.info(f"Successfully spawned workflow: {script_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to spawn workflow: {e}")
        return False


def main():
    """Main entry point."""

    # Parse arguments
    args = sys.argv[1:]
    run_once = "--once" in args
    dry_run = "--dry-run" in args

    if run_once:
        logger.info("Running in single-cycle mode")

    # Load configuration
    project_id = os.getenv("TEAMWORK_PROJECT_ID", "805682")
    polling_interval = int(os.getenv("TEAMWORK_POLLING_INTERVAL", "15"))
    max_concurrent = int(os.getenv("TEAMWORK_MAX_CONCURRENT_TASKS", "3"))

    config = TeamworkCronConfig(
        project_id=project_id,
        polling_interval=polling_interval,
        max_concurrent_tasks=max_concurrent,
        dry_run=dry_run
    )

    logger.info(f"Configuration: project_id={config.project_id}, "
                f"polling_interval={config.polling_interval}s, "
                f"max_concurrent={config.max_concurrent_tasks}")

    # Main monitoring loop
    while True:
        logger.info("=== Starting polling cycle ===")

        print()
        print("=" * 60)
        print("IMPORTANT: This simplified monitor requires MANUAL task fetching")
        print("=" * 60)
        print()
        print("Since programmatic 'claude -p' is blocked, please:")
        print()
        print("1. Fetch tasks manually using MCP tools in this session:")
        print(f"   mcp__teamwork__twprojects-list_tasks_by_project")
        print(f"     project_id={config.project_id}")
        print(f"     page_size=10")
        print()
        print("2. For each task with status='new' and 'execute' trigger:")
        print("   - Note the task ID")
        print("   - Run workflow manually (see below)")
        print()
        print("3. Or wait for programmatic execution limit to reset, then use:")
        print("   ./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once")
        print()
        print("=" * 60)
        print()
        print("MANUAL WORKFLOW EXECUTION:")
        print()
        print("# For Bun prototype tasks (with prototype:bun_scripts tag):")
        print(f"./adws/adw_plan_implement_update_teamwork_task.py \\")
        print(f"  test_$(date +%s) \\")
        print(f"  <TASK_ID> \\")
        print(f"  \"<TASK_DESCRIPTION>\" \\")
        print(f"  proto-<name> \\")
        print(f"  bun_scripts \\")
        print(f"  --model sonnet \\")
        print(f"  --project-id {config.project_id}")
        print()
        print("# For simple tasks (NO prototype tag):")
        print(f"./adws/adw_build_update_teamwork_task.py \\")
        print(f"  test_$(date +%s) \\")
        print(f"  <TASK_ID> \\")
        print(f"  \"<TASK_DESCRIPTION>\" \\")
        print(f"  feat-<name> \\")
        print(f"  --model sonnet \\")
        print(f"  --project-id {config.project_id}")
        print()
        print("=" * 60)
        print()

        if run_once:
            logger.info("Single-cycle mode: Exiting after one iteration")
            break

        logger.info(f"Sleeping for {config.polling_interval} seconds...")
        time.sleep(config.polling_interval)

    logger.info("Monitor stopped")


if __name__ == "__main__":
    main()
