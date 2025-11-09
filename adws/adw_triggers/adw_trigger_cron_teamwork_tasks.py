#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pydantic",
#   "python-dotenv",
#   "click",
#   "rich",
#   "schedule",
# ]
# ///
"""
Teamwork Task Monitor - Continuous polling for agent-ready tasks.

Monitors a Teamwork project for tasks with execution triggers and delegates them
to appropriate workflow scripts. Runs continuously with configurable polling interval.
"""

import os
import sys
import time
import json
import logging
import argparse
import subprocess
from pathlib import Path
from typing import List, Optional
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from adw_modules.data_models import TeamworkTask, TeamworkCronConfig
from adw_modules.agent import execute_template, AgentTemplateRequest, generate_short_id
from adw_modules.utils import parse_json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TeamworkTaskManager:
    """Manages fetching and delegating tasks from Teamwork."""

    def __init__(self, config: TeamworkCronConfig):
        self.config = config
        self.project_id = config.project_id
        self.status_mapping = config.status_mapping
        self.active_adw_ids = set()

    def get_eligible_tasks(self, limit: int = 10) -> List[TeamworkTask]:
        """Fetch eligible tasks from Teamwork project."""
        logger.info(f"Fetching tasks from Teamwork project {self.project_id}")

        # Build request for /get_teamwork_tasks
        request = AgentTemplateRequest(
            agent_name="teamwork-task-fetcher",
            slash_command="/get_teamwork_tasks",
            args=[
                self.project_id,
                json.dumps(self.config.status_filter),
                str(limit)
            ],
            adw_id=generate_short_id(),
            model="sonnet",
            working_dir=os.getcwd()
        )

        # Execute via agent framework
        try:
            response = execute_template(request)

            if not response.success:
                logger.error(f"Failed to fetch Teamwork tasks: {response.output}")
                return []

            # Parse JSON response
            task_data = parse_json(response.output, list)
            if not task_data:
                logger.info("No tasks returned from Teamwork")
                return []

            # Convert to TeamworkTask objects
            tasks = []
            for task_dict in task_data:
                try:
                    teamwork_task = TeamworkTask(
                        task_id=task_dict.get("task_id"),
                        project_id=task_dict.get("project_id"),
                        title=task_dict.get("title", ""),
                        status=task_dict.get("status"),
                        description=task_dict.get("description", ""),
                        tags=task_dict.get("tags", {}),
                        execution_trigger=task_dict.get("execution_trigger"),
                        task_prompt=task_dict.get("task_prompt", ""),
                        worktree=task_dict.get("tags", {}).get("worktree"),
                        model=task_dict.get("tags", {}).get("model"),
                        workflow_type=task_dict.get("tags", {}).get("workflow"),
                        prototype=task_dict.get("tags", {}).get("prototype"),
                        assigned_to=task_dict.get("assigned_to"),
                        created_time=task_dict.get("created_time"),
                        due_date=task_dict.get("due_date")
                    )

                    if teamwork_task.is_eligible_for_processing():
                        tasks.append(teamwork_task)
                        logger.info(f"Found eligible task: {teamwork_task.task_id} - {teamwork_task.title}")
                    else:
                        logger.debug(f"Skipping ineligible task: {teamwork_task.task_id}")

                except Exception as e:
                    logger.error(f"Failed to parse task: {e}")
                    continue

            return tasks

        except Exception as e:
            logger.error(f"Exception while fetching tasks: {e}", exc_info=True)
            return []

    def update_task_status(
        self,
        task_id: str,
        status: str,
        update_content: str = ""
    ) -> bool:
        """Update Teamwork task status and post comment."""
        logger.info(f"Updating task {task_id} to status: {status}")

        # Map system status to Teamwork status
        teamwork_status = self.config.map_status_to_teamwork(status)

        # Build update request
        request = AgentTemplateRequest(
            agent_name="teamwork-task-updater",
            slash_command="/update_teamwork_task",
            args=[
                task_id,
                teamwork_status,
                update_content
            ],
            adw_id=generate_short_id(),
            model="sonnet",
            working_dir=os.getcwd()
        )

        # Execute update
        try:
            response = execute_template(request)

            if response.success:
                logger.info(f"Successfully updated task {task_id} to {teamwork_status}")
                return True
            else:
                logger.error(f"Failed to update task {task_id}: {response.output}")
                return False

        except Exception as e:
            logger.error(f"Exception while updating task {task_id}: {e}")
            return False

    def delegate_task(self, task: TeamworkTask) -> bool:
        """Delegate task to appropriate workflow script."""
        # Generate ADW ID
        adw_id = generate_short_id()

        # Check for duplicates
        if adw_id in self.active_adw_ids:
            logger.warning(f"Duplicate ADW ID detected: {adw_id}, regenerating...")
            adw_id = generate_short_id()

        self.active_adw_ids.add(adw_id)

        # Get model preference
        model = task.get_preferred_model()

        # Get worktree name
        worktree_name = task.worktree or task.tags.get("worktree")
        if not worktree_name:
            # Generate from task description
            worktree_name = self._generate_worktree_name(task)

        # Get task prompt
        task_prompt = task.get_task_prompt_for_agent()

        logger.info(f"Delegating task {task.task_id} with ADW ID {adw_id}")
        logger.info(f"  Model: {model}")
        logger.info(f"  Worktree: {worktree_name}")
        logger.info(f"  Workflow: {self._determine_workflow(task)}")

        # Claim task immediately
        update_metadata = {
            "adw_id": adw_id,
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "worktree_name": worktree_name,
            "status": "In progress"
        }

        if not self.update_task_status(
            task.task_id,
            "In progress",
            json.dumps(update_metadata)
        ):
            logger.error(f"Failed to claim task {task.task_id}")
            self.active_adw_ids.discard(adw_id)
            return False

        # Determine workflow script
        if task.prototype:
            script_path = "./adws/adw_plan_implement_update_teamwork_task.py"
            script_args = [
                adw_id,
                task.task_id,
                task_prompt,
                worktree_name,
                task.prototype,
                model,
                self.project_id
            ]
        elif task.should_use_full_workflow():
            script_path = "./adws/adw_plan_implement_update_teamwork_task.py"
            script_args = [
                adw_id,
                task.task_id,
                task_prompt,
                worktree_name,
                "",  # No prototype
                model,
                self.project_id
            ]
        else:
            script_path = "./adws/adw_build_update_teamwork_task.py"
            script_args = [
                adw_id,
                task.task_id,
                task_prompt,
                worktree_name,
                model,
                self.project_id
            ]

        if self.config.dry_run:
            logger.info(f"[DRY RUN] Would spawn: {script_path} {' '.join(script_args)}")
            return True

        # Spawn detached subprocess
        try:
            subprocess.Popen(
                [script_path] + script_args,
                start_new_session=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            logger.info(f"Successfully spawned workflow for task {task.task_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to spawn workflow: {e}")
            # Update task to Failed status
            error_metadata = {
                "adw_id": adw_id,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            self.update_task_status(
                task.task_id,
                "Failed",
                json.dumps(error_metadata)
            )
            self.active_adw_ids.discard(adw_id)
            return False

    def _determine_workflow(self, task: TeamworkTask) -> str:
        """Determine which workflow to use for task."""
        if task.prototype:
            return f"plan-implement ({task.prototype})"
        elif task.should_use_full_workflow():
            return "plan-implement"
        else:
            return "build"

    def _generate_worktree_name(self, task: TeamworkTask) -> str:
        """Generate a worktree name from task title."""
        import re
        # Simple sanitization
        name = task.title.lower()
        name = re.sub(r'[^a-z0-9]+', '-', name)
        name = name.strip('-')
        # Limit length
        if len(name) > 50:
            name = name[:50]
        return f"proto-{name}" if task.prototype else f"feat-{name}"

    def run_once(self) -> int:
        """Run a single polling cycle. Returns number of tasks processed."""
        logger.info("=== Starting polling cycle ===")

        # Get eligible tasks
        tasks = self.get_eligible_tasks(limit=self.config.max_concurrent_tasks)

        if not tasks:
            logger.info("No eligible tasks found")
            return 0

        logger.info(f"Found {len(tasks)} eligible task(s)")

        # Delegate each task
        processed = 0
        for task in tasks:
            if self.delegate_task(task):
                processed += 1
            time.sleep(1)  # Brief delay between delegations

        logger.info(f"=== Polling cycle complete: {processed}/{len(tasks)} tasks delegated ===")
        return processed

    def run_continuous(self):
        """Run continuous polling loop."""
        logger.info("Starting Teamwork task monitor")
        logger.info(f"Project ID: {self.project_id}")
        logger.info(f"Polling interval: {self.config.polling_interval}s")
        logger.info(f"Max concurrent tasks: {self.config.max_concurrent_tasks}")
        logger.info(f"Status filter: {self.config.status_filter}")
        logger.info(f"Dry run: {self.config.dry_run}")

        cycle_count = 0

        try:
            while True:
                cycle_count += 1
                logger.info(f"\n--- Cycle {cycle_count} ---")

                self.run_once()

                logger.info(f"Sleeping for {self.config.polling_interval}s...")
                time.sleep(self.config.polling_interval)

        except KeyboardInterrupt:
            logger.info("\nReceived interrupt signal, shutting down gracefully...")
        except Exception as e:
            logger.error(f"Fatal error in polling loop: {e}")
            raise


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Teamwork task monitor for multi-agent prototyping system"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once and exit (no continuous monitoring)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run in dry-run mode without making changes"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=15,
        help="Polling interval in seconds (default: 15)"
    )
    parser.add_argument(
        "--max-tasks",
        type=int,
        default=3,
        help="Maximum concurrent tasks (default: 3)"
    )

    args = parser.parse_args()

    # Load configuration from environment
    project_id = os.getenv("TEAMWORK_PROJECT_ID")
    if not project_id:
        logger.error("TEAMWORK_PROJECT_ID environment variable is required")
        sys.exit(1)

    # Build configuration
    config = TeamworkCronConfig(
        project_id=project_id,
        polling_interval=args.interval,
        max_concurrent_tasks=args.max_tasks,
        dry_run=args.dry_run
    )

    # Create manager
    manager = TeamworkTaskManager(config)

    # Run
    if args.once:
        logger.info("Running in single-cycle mode")
        processed = manager.run_once()
        logger.info(f"Processed {processed} task(s)")
        sys.exit(0)
    else:
        manager.run_continuous()


if __name__ == "__main__":
    main()
