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
Plan-Implement workflow with Teamwork task updates.

Complex workflow: /plan → /implement → /update_teamwork_task
Supports prototype-specific planning commands.
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
    prototype: str = "",
    model: str = "sonnet",
    project_id: Optional[str] = None
):
    """Execute plan-implement workflow and update Teamwork task."""

    logger.info("=== Starting Plan-Implement Workflow ===")
    logger.info(f"ADW ID: {adw_id}")
    logger.info(f"Task ID: {task_id}")
    logger.info(f"Worktree: {worktree_name}")
    logger.info(f"Prototype: {prototype or 'None'}")
    logger.info(f"Model: {model}")

    workflow_success = False
    commit_hash = None
    error_message = None
    plan_path = None

    # Determine working directory
    worktree_path = Path(f"../trees/{worktree_name}/tac8_app4__agentic_prototyping")

    if worktree_path.exists():
        working_dir = str(worktree_path.absolute())
        logger.info(f"Using existing worktree: {working_dir}")
    else:
        working_dir = os.getcwd()
        logger.info(f"Worktree not found, using current directory: {working_dir}")

    try:
        # === Phase 1: Planning ===
        logger.info("=== Phase 1: Planning ===")

        # Determine plan command based on prototype type
        if prototype:
            if prototype == "uv_script":
                plan_command = "/plan_uv_script"
            elif prototype == "vite_vue":
                plan_command = "/plan_vite_vue"
            elif prototype == "bun_scripts":
                plan_command = "/plan_bun_scripts"
            elif prototype == "uv_mcp":
                plan_command = "/plan_uv_mcp"
            else:
                logger.warning(f"Unknown prototype type: {prototype}, using /plan")
                plan_command = "/plan"
        else:
            plan_command = "/plan"

        logger.info(f"Using planning command: {plan_command}")

        plan_request = AgentTemplateRequest(
            agent_name=f"plan-{worktree_name}",
            slash_command=plan_command,
            args=[adw_id, task_description],
            adw_id=adw_id,
            model=model,
            working_dir=working_dir
        )

        plan_response = execute_template(plan_request)

        if not plan_response.success:
            error_message = f"Planning failed: {plan_response.output}"
            logger.error(error_message)
            raise Exception(error_message)

        logger.info("Planning completed successfully")

        # Try to find the generated plan file
        specs_dir = Path(working_dir) / "specs"
        if specs_dir.exists():
            # Look for most recently created plan file
            plan_files = list(specs_dir.glob("plan-*.md"))
            if plan_files:
                plan_path = str(max(plan_files, key=lambda p: p.stat().st_mtime))
                logger.info(f"Found plan file: {plan_path}")
            else:
                logger.warning("No plan file found in specs/")
        else:
            logger.warning("specs/ directory not found")

        # === Phase 2: Implementation ===
        logger.info("=== Phase 2: Implementation ===")

        if plan_path:
            implement_args = [adw_id, plan_path]
        else:
            # Fallback: use task description
            implement_args = [adw_id, task_description]

        implement_request = AgentTemplateRequest(
            agent_name=f"implement-{worktree_name}",
            slash_command="/implement",
            args=implement_args,
            adw_id=adw_id,
            model=model,
            working_dir=working_dir
        )

        implement_response = execute_template(implement_request)

        if not implement_response.success:
            error_message = f"Implementation failed: {implement_response.output}"
            logger.error(error_message)
            raise Exception(error_message)

        logger.info("Implementation completed successfully")
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
        error_message = f"Exception during workflow: {str(e)}"
        logger.error(error_message)

    # === Phase 3: Update Teamwork ===
    logger.info("=== Phase 3: Updating Teamwork ===")

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
        "workflow": "plan-implement-update",
        "worktree_name": worktree_name,
        "prototype": prototype or "",
        "plan_path": plan_path or "",
        "result": implement_response.output if workflow_success and implement_response else ""
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

    logger.info("=== Plan-Implement Workflow Complete ===")

    # Exit with appropriate code
    sys.exit(0 if workflow_success else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Plan-Implement workflow with Teamwork task updates"
    )
    parser.add_argument("adw_id", help="ADW execution ID")
    parser.add_argument("task_id", help="Teamwork task ID")
    parser.add_argument("task_description", help="Task description")
    parser.add_argument("worktree_name", help="Git worktree name")
    parser.add_argument("prototype", nargs="?", default="", help="Prototype type")
    parser.add_argument("--model", default="sonnet", help="Claude model")
    parser.add_argument("--project-id", help="Teamwork project ID")

    args = parser.parse_args()
    main(
        args.adw_id,
        args.task_id,
        args.task_description,
        args.worktree_name,
        args.prototype,
        args.model,
        args.project_id
    )
