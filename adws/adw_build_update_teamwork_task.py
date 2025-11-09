#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pydantic",
#   "python-dotenv",
#   "click",
#   "rich",
# ]
# ///
"""
Build workflow with Teamwork task updates.

Simple workflow: /build → /update_teamwork_task
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from adw_modules.agent import execute_template, AgentTemplateRequest
from adw_modules.data_models import TeamworkTaskUpdate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main(
    adw_id: str,
    task_id: str,
    task_description: str,
    worktree_name: str,
    model: str = "sonnet",
    project_id: Optional[str] = None
):
    """Execute build workflow and update Teamwork task."""

    logger.info("=== Starting Build Workflow ===")
    logger.info(f"ADW ID: {adw_id}")
    logger.info(f"Task ID: {task_id}")
    logger.info(f"Worktree: {worktree_name}")
    logger.info(f"Model: {model}")

    workflow_success = False
    commit_hash = None
    error_message = None

    # Determine working directory
    worktree_path = Path(f"../trees/{worktree_name}/tac8_app4__agentic_prototyping")

    if worktree_path.exists():
        working_dir = str(worktree_path.absolute())
        logger.info(f"Using existing worktree: {working_dir}")
    else:
        working_dir = os.getcwd()
        logger.info(f"Worktree not found, using current directory: {working_dir}")

    try:
        # Execute /build command
        logger.info("Executing /build command...")

        build_request = AgentTemplateRequest(
            agent_name=f"build-{worktree_name}",
            slash_command="/build",
            args=[task_description, "."],
            adw_id=adw_id,
            model=model,
            working_dir=working_dir
        )

        build_response = execute_template(build_request)

        if not build_response.success:
            error_message = f"Build failed: {build_response.output}"
            logger.error(error_message)
        else:
            logger.info("Build completed successfully")
            workflow_success = True

            # Try to get commit hash from git
            try:
                import subprocess
                result = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd=working_dir,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    commit_hash = result.stdout.strip()[:8]
                    logger.info(f"Commit hash: {commit_hash}")
            except Exception as e:
                logger.warning(f"Could not get commit hash: {e}")

    except Exception as e:
        error_message = f"Exception during build: {str(e)}"
        logger.error(error_message)

    # Determine final status
    update_status = "Done" if workflow_success and commit_hash else "Failed"

    # Build result payload
    update_content = {
        "status": update_status,
        "adw_id": adw_id,
        "commit_hash": commit_hash or "",
        "error": error_message or "",
        "timestamp": datetime.now().isoformat(),
        "model": model,
        "workflow": "build-update",
        "worktree_name": worktree_name,
        "result": build_response.output if workflow_success and build_response else ""
    }

    # Execute update
    logger.info(f"Updating Teamwork task to {update_status}...")

    update_request = AgentTemplateRequest(
        agent_name=f"teamwork-updater-{worktree_name}",
        slash_command="/update_teamwork_task",
        args=[task_id, update_status, json.dumps(update_content)],
        adw_id=adw_id,
        model=model,
        working_dir=working_dir
    )

    update_response = execute_template(update_request)

    if update_response.success:
        logger.info(f"Successfully updated Teamwork task {task_id} to {update_status}")
    else:
        logger.error(f"Failed to update Teamwork task: {update_response.output}")

    logger.info("=== Build Workflow Complete ===")

    # Exit with appropriate code
    sys.exit(0 if workflow_success else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build workflow with Teamwork task updates")
    parser.add_argument("adw_id", help="ADW execution ID")
    parser.add_argument("task_id", help="Teamwork task ID")
    parser.add_argument("task_description", help="Task description")
    parser.add_argument("worktree_name", help="Git worktree name")
    parser.add_argument("--model", default="sonnet", help="Claude model")
    parser.add_argument("--project-id", help="Teamwork project ID")

    args = parser.parse_args()
    main(
        args.adw_id,
        args.task_id,
        args.task_description,
        args.worktree_name,
        args.model,
        args.project_id
    )
