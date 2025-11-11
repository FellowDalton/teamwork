#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
#     "pydantic>=2.0.0",
# ]
# ///
"""
Teamwork task monitor using split commands to reduce MCP call load.

Instead of calling /get_teamwork_tasks (which makes 30-40 MCP calls),
this uses smaller focused commands:
- /list_teamwork_tasks - ONE MCP call to list tasks
- /check_task_eligibility - Text parsing only, no MCP calls
- /parse_task_tags - N MCP calls (only for eligible tasks)
- /extract_task_prompt - Text parsing only

This reduces load and avoids hitting programmatic execution limits.
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

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from adw_modules.data_models import TeamworkTask, TeamworkCronConfig
from adw_modules.agent import execute_template, AgentTemplateRequest, generate_short_id

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def extract_inline_tags(description: str) -> Dict[str, str]:
    """Extract inline tags from description without MCP calls."""
    tags = {}
    pattern = r'\{\{(\w+):\s*([^}]+)\}\}'
    matches = re.findall(pattern, description)
    for key, value in matches:
        tags[key.strip()] = value.strip()
    return tags


def detect_execution_trigger(description: str) -> Optional[str]:
    """Detect execution trigger without MCP calls."""
    if description.strip().endswith('execute'):
        return "execute"
    if re.search(r'continue\s*-\s*.+', description, re.IGNORECASE):
        return "continue"
    return None


def extract_task_prompt(description: str, execution_trigger: Optional[str]) -> str:
    """Extract clean prompt without MCP calls."""
    prompt = description
    prompt = re.sub(r'\{\{\w+:\s*[^}]+\}\}', '', prompt)

    if execution_trigger == "execute":
        prompt = re.sub(r'\s*execute\s*$', '', prompt, flags=re.IGNORECASE)
    elif execution_trigger == "continue":
        match = re.search(r'continue\s*-\s*(.+)', prompt, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()

    return prompt.strip()


def make_worktree_name(task_description: str, has_prototype: bool = False) -> str:
    """Generate worktree name from task description."""
    name = task_description[:50].lower()
    name = re.sub(r'[^a-z0-9]+', '-', name)
    name = name.strip('-')

    prefix = "proto" if has_prototype else "feat"
    return f"{prefix}-{name}" if name else f"{prefix}-task-{generate_short_id()}"


def spawn_workflow(script_path: str, args: List[str], dry_run: bool = False) -> bool:
    """Spawn detached workflow subprocess."""
    if dry_run:
        logger.info(f"DRY RUN: Would spawn: {script_path} {' '.join(args)}")
        return True

    try:
        subprocess.Popen(
            [script_path] + args,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        logger.info(f"Spawned workflow: {script_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to spawn workflow: {e}")
        return False


def main():
    """Main entry point."""

    # Parse arguments
    import argparse
    parser = argparse.ArgumentParser(description="Teamwork task monitor (split commands)")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    parser.add_argument("--interval", type=int, default=15, help="Polling interval")
    parser.add_argument("--max-tasks", type=int, default=3, help="Max concurrent tasks")
    args = parser.parse_args()

    if args.once:
        logger.info("Running in single-cycle mode")

    # Load configuration
    project_id = os.getenv("TEAMWORK_PROJECT_ID", "805682")

    config = TeamworkCronConfig(
        project_id=project_id,
        polling_interval=args.interval,
        max_concurrent_tasks=args.max_tasks,
        dry_run=args.dry_run
    )

    logger.info(f"Config: project_id={project_id}, interval={args.interval}s, max={args.max_tasks}")

    # Main loop
    while True:
        logger.info("=== Starting polling cycle ===")
        logger.info(f"Fetching tasks from Teamwork project {project_id}")

        # Step 1: List tasks (ONE MCP call)
        request = AgentTemplateRequest(
            agent_name="list-tasks",
            slash_command="/list_teamwork_tasks",
            args=[project_id, "10"],
            adw_id=generate_short_id(),
            model="sonnet",
            working_dir=os.getcwd()
        )

        try:
            response = execute_template(request)

            if not response.success:
                logger.error(f"Failed to list tasks: {response.output}")
                logger.info("No eligible tasks found")
                if args.once:
                    break
                time.sleep(args.interval)
                continue

            # Parse response
            try:
                data = json.loads(response.output)
                tasks = data.get("tasks", [])
            except:
                logger.error(f"Failed to parse response: {response.output[:200]}")
                logger.info("No eligible tasks found")
                if args.once:
                    break
                time.sleep(args.interval)
                continue

            logger.info(f"Retrieved {len(tasks)} tasks from Teamwork")

            # Step 2: Process each task (NO MCP calls for eligibility check)
            eligible_tasks = []

            for task in tasks:
                task_id = str(task.get("id"))
                description = task.get("description", "")
                status = task.get("status", "").lower()

                # Check status filter
                if status not in ["new", "to do", "review"]:
                    continue

                # Check eligibility (no MCP call)
                execution_trigger = detect_execution_trigger(description)
                if not execution_trigger:
                    continue

                logger.info(f"Found eligible task: {task_id} - {task.get('name')}")

                # Extract inline tags (no MCP call)
                inline_tags = extract_inline_tags(description)

                # Parse native tags (ONLY if task is eligible)
                # This is where we make MCP calls, but only for eligible tasks
                native_tags = {}
                tag_ids = [t.get("id") for t in task.get("tags", [])]

                if tag_ids:
                    logger.info(f"Task {task_id} has {len(tag_ids)} tags, fetching names...")
                    # TODO: Call /parse_task_tags for this specific task
                    # For now, just use inline tags
                    pass

                # Merge tags (native takes precedence)
                merged_tags = {**inline_tags, **native_tags}

                # Extract clean prompt (no MCP call)
                task_prompt = extract_task_prompt(description, execution_trigger)

                eligible_tasks.append({
                    "task_id": task_id,
                    "title": task.get("name"),
                    "description": description,
                    "status": status,
                    "tags": merged_tags,
                    "execution_trigger": execution_trigger,
                    "task_prompt": task_prompt,
                    "priority": task.get("priority")
                })

            logger.info(f"Found {len(eligible_tasks)} eligible task(s)")

            # Step 3: Spawn workflows for eligible tasks
            processed = 0
            for task in eligible_tasks[:config.max_concurrent_tasks]:
                task_id = task["task_id"]
                task_prompt = task["task_prompt"]
                tags = task["tags"]

                # Generate ADW ID
                adw_id = generate_short_id()

                # Determine workflow based on tags
                prototype = tags.get("prototype")
                has_prototype = bool(prototype)
                model = tags.get("model", "sonnet")

                # Generate worktree name
                worktree_name = make_worktree_name(task_prompt, has_prototype)

                # Choose workflow script
                if prototype:
                    script_path = "./adws/adw_plan_implement_update_teamwork_task.py"
                    script_args = [
                        adw_id,
                        task_id,
                        task_prompt,
                        worktree_name,
                        prototype,
                        "--model", model,
                        "--project-id", project_id
                    ]
                    logger.info(f"Routing task {task_id} to plan-implement workflow (prototype: {prototype})")
                else:
                    script_path = "./adws/adw_build_update_teamwork_task.py"
                    script_args = [
                        adw_id,
                        task_id,
                        task_prompt,
                        worktree_name,
                        "--model", model,
                        "--project-id", project_id
                    ]
                    logger.info(f"Routing task {task_id} to build workflow")

                # Spawn workflow
                if spawn_workflow(script_path, script_args, args.dry_run):
                    processed += 1
                    logger.info(f"Successfully spawned workflow for task {task_id}")
                else:
                    logger.error(f"Failed to spawn workflow for task {task_id}")

            logger.info(f"Processed {processed} task(s)")

        except Exception as e:
            logger.error(f"Error in polling cycle: {e}", exc_info=True)

        if args.once:
            logger.info("Single-cycle mode: Exiting")
            break

        logger.info(f"Sleeping for {args.interval} seconds...")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
