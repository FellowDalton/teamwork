"""
Data models for the multi-agent task list architecture.

These models define the structure for tasks, worktrees, and workflow states
used throughout the ToDone system.
"""

from typing import List, Optional, Literal, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator


class SystemTag(str, Enum):
    """System-defined tags that control task execution behavior."""

    # Workflow selection tags
    PLAN_IMPLEMENT_UPDATE = "adw_plan_implement_update_task"

    # Model selection tags
    OPUS = "opus"
    SONNET = "sonnet"

    @classmethod
    def get_workflow_tags(cls) -> List[str]:
        """Get all workflow-related tags."""
        return [cls.PLAN_IMPLEMENT_UPDATE]

    @classmethod
    def get_model_tags(cls) -> List[str]:
        """Get all model-related tags."""
        return [cls.OPUS, cls.SONNET]

    @classmethod
    def extract_model_from_tags(cls, tags: List[str]) -> Optional[str]:
        """Extract the model to use from tags.

        Priority: opus > sonnet > default (None)
        """
        if cls.OPUS in tags:
            return "opus"
        elif cls.SONNET in tags:
            return "sonnet"
        return None

    @classmethod
    def extract_workflow_from_tags(cls, tags: List[str]) -> bool:
        """Check if full workflow should be used based on tags."""
        return cls.PLAN_IMPLEMENT_UPDATE in tags


class Task(BaseModel):
    """Represents a single task in the task list."""

    description: str = Field(..., description="The task description")
    status: Literal["[]", "[⏰]", "[🟡]", "[✅]", "[❌]"] = Field(
        default="[]", description="Current status of the task"
    )
    adw_id: Optional[str] = Field(
        None, description="ADW ID assigned when task is picked up"
    )
    commit_hash: Optional[str] = Field(
        None, description="Git commit hash when task is completed"
    )
    tags: List[str] = Field(
        default_factory=list, description="Optional tags for the task"
    )
    worktree_name: Optional[str] = Field(
        None, description="Associated git worktree name"
    )

    @validator("status")
    def validate_status(cls, v):
        """Ensure status is one of the valid values."""
        valid_statuses = ["[]", "[⏰]", "[🟡]", "[✅]", "[❌]"]
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return v

    def is_eligible_for_pickup(self) -> bool:
        """Check if task can be picked up by an agent."""
        return self.status in ["[]", "[⏰]"]

    def is_completed(self) -> bool:
        """Check if task is in a terminal state."""
        return self.status in ["[✅]", "[❌]"]


class Worktree(BaseModel):
    """Represents a git worktree section in the task list."""

    name: str = Field(..., description="Name of the git worktree")
    tasks: List[Task] = Field(
        default_factory=list, description="Tasks in this worktree"
    )

    def get_eligible_tasks(self) -> List[Task]:
        """Get all tasks eligible for pickup, considering blocking rules."""
        eligible = []

        for i, task in enumerate(self.tasks):
            if task.status == "[]":
                # Non-blocked tasks are always eligible
                eligible.append(task)
            elif task.status == "[⏰]":
                # Blocked tasks are eligible only if all tasks above are successful
                all_above_successful = all(t.status == "[✅]" for t in self.tasks[:i])
                if all_above_successful:
                    eligible.append(task)

        return eligible


class TaskToStart(BaseModel):
    """Task ready to be started by an agent."""

    description: str = Field(..., description="The task description")
    tags: List[str] = Field(
        default_factory=list, description="Optional tags for the task"
    )


class WorktreeTaskGroup(BaseModel):
    """Groups tasks by worktree for processing."""

    worktree_name: str = Field(..., description="Name of the git worktree")
    tasks_to_start: List[TaskToStart] = Field(
        ..., description="Tasks ready to be started in this worktree"
    )


class ProcessTasksResponse(BaseModel):
    """Response from the /process_tasks command."""

    task_groups: List[WorktreeTaskGroup] = Field(
        default_factory=list, description="Tasks grouped by worktree"
    )

    def has_tasks(self) -> bool:
        """Check if there are any tasks to process."""
        return any(len(group.tasks_to_start) > 0 for group in self.task_groups)


class TaskUpdate(BaseModel):
    """Update information for a task after agent processing."""

    adw_id: str = Field(..., description="ADW ID of the task")
    status: Literal["[✅]", "[❌]"] = Field(..., description="Final status of the task")
    commit_hash: Optional[str] = Field(
        None, description="Git commit hash if successful"
    )
    error_message: Optional[str] = Field(None, description="Error message if failed")
    worktree_name: str = Field(..., description="Worktree where task was executed")
    task_description: str = Field(..., description="Original task description")

    @validator("status")
    def validate_final_status(cls, v):
        """Ensure status is a terminal state."""
        if v not in ["[✅]", "[❌]"]:
            raise ValueError("Task update status must be either [✅] or [❌]")
        return v

    @validator("commit_hash")
    def validate_commit_hash(cls, v, values):
        """Ensure commit hash is provided for successful tasks."""
        if values.get("status") == "[✅]" and not v:
            raise ValueError("Commit hash is required for successful tasks")
        return v


class WorkflowState(BaseModel):
    """Tracks the state of a workflow execution."""

    adw_id: str = Field(..., description="Unique ADW ID for this workflow")
    worktree_name: str = Field(..., description="Git worktree name")
    task_description: str = Field(..., description="Task being processed")
    phase: Literal["planning", "implementing", "updating", "completed", "failed"] = (
        Field(..., description="Current phase of the workflow")
    )
    started_at: datetime = Field(
        default_factory=datetime.now, description="Workflow start time"
    )
    completed_at: Optional[datetime] = Field(
        None, description="Workflow completion time"
    )
    plan_path: Optional[str] = Field(None, description="Path to generated plan file")
    error: Optional[str] = Field(None, description="Error message if workflow failed")

    def mark_completed(self, success: bool = True, error: Optional[str] = None):
        """Mark workflow as completed."""
        self.completed_at = datetime.now()
        self.phase = "completed" if success else "failed"
        if error:
            self.error = error


class CronTriggerConfig(BaseModel):
    """Configuration for the cron trigger."""

    polling_interval: int = Field(
        default=5, ge=1, description="Polling interval in seconds"
    )
    dry_run: bool = Field(
        default=False, description="Run in dry-run mode without making changes"
    )
    max_concurrent_tasks: int = Field(
        default=5, ge=1, description="Maximum number of concurrent tasks to process"
    )
    task_file_path: str = Field(
        default="tasks.md", description="Path to the task list file"
    )
    worktree_base_path: str = Field(
        default="trees", description="Base directory for git worktrees"
    )


class WorktreeConfig(BaseModel):
    """Configuration for creating a new worktree."""

    worktree_name: str = Field(..., description="Name of the worktree to create")
    base_branch: str = Field(
        default="main", description="Base branch to create worktree from"
    )
    copy_env: bool = Field(
        default=True, description="Whether to copy .env file to worktree"
    )


class WorktreeCreationRequest(BaseModel):
    """Request for automatic worktree creation."""

    task_description: str = Field(..., description="Task description for context")
    suggested_name: Optional[str] = Field(
        None, description="User-suggested worktree name"
    )
    base_branch: str = Field(
        default="main", description="Base branch for worktree"
    )
    app_context: Optional[str] = Field(
        None, description="App context for worktree creation"
    )
    prefix: Optional[str] = Field(
        None, description="Prefix for worktree name generation"
    )

    def generate_name_args(self) -> List[str]:
        """Generate arguments for /make_worktree_name command."""
        return [
            self.task_description,
            self.app_context or "",
            self.prefix or ""
        ]


# Teamwork-specific models for the rapid prototyping multi-agent system

class TeamworkTask(BaseModel):
    """Represents a task from Teamwork."""

    task_id: str = Field(..., description="Teamwork task ID")
    project_id: str = Field(..., description="Teamwork project ID")
    title: str = Field(..., description="Task title/name")
    status: str = Field(..., description="Current task status")
    description: str = Field(default="", description="Task description text")
    tags: Dict[str, str] = Field(
        default_factory=dict, description="Extracted tags (native + inline {{key: value}})"
    )
    worktree: Optional[str] = Field(None, description="Target worktree name")
    model: Optional[str] = Field(None, description="Claude model preference (opus/sonnet)")
    workflow_type: Optional[str] = Field(None, description="Workflow to use (build/plan-implement)")
    prototype: Optional[str] = Field(
        None, description="Prototype type (uv_script/vite_vue/bun_scripts/uv_mcp)"
    )
    execution_trigger: Optional[str] = Field(None, description="Execution command (execute/continue)")
    task_prompt: Optional[str] = Field(None, description="Extracted task prompt for agent processing")
    assigned_to: Optional[str] = Field(None, description="User assigned to this task")
    created_time: Optional[datetime] = Field(None, description="Task creation timestamp")
    last_edited_time: Optional[datetime] = Field(None, description="Last modification timestamp")
    due_date: Optional[str] = Field(None, description="Task due date")
    priority: Optional[str] = Field(None, description="Task priority")
    estimated_minutes: Optional[int] = Field(None, description="Estimated time in minutes")

    def is_eligible_for_processing(self) -> bool:
        """Check if task is ready for agent processing."""
        eligible_statuses = ["new", "to do", "review"]
        return (
            self.status and self.status.lower() in eligible_statuses and
            self.execution_trigger in ["execute", "continue"]
        )

    def extract_tags_from_description(self) -> Dict[str, str]:
        """Extract inline {{key: value}} tags from description."""
        import re
        pattern = r'\{\{(\w+):\s*([^}]+)\}\}'
        matches = re.findall(pattern, self.description)
        return {key: value.strip() for key, value in matches}

    def get_task_prompt_for_agent(self) -> str:
        """Get the cleaned task prompt for agent execution."""
        import re
        if self.execution_trigger == "continue":
            return self.task_prompt or ""
        else:
            desc = self.description
            desc = re.sub(r'\{\{[^}]+\}\}', '', desc)
            desc = desc.replace("execute", "")
            return desc.strip()

    def extract_app_context(self) -> Optional[str]:
        """Extract app context from tags."""
        return self.tags.get("app")

    def get_preferred_model(self) -> str:
        """Get the preferred Claude model, defaulting to sonnet."""
        model = self.model or self.tags.get("model", "sonnet")
        return model if model in ["opus", "sonnet"] else "sonnet"

    def should_use_full_workflow(self) -> bool:
        """Determine if task should use plan-implement-update workflow."""
        return (
            self.workflow_type == "plan" or
            self.tags.get("workflow") == "plan" or
            len(self.task_prompt or "") > 500
        )


class TeamworkTaskUpdate(BaseModel):
    """Update payload for Teamwork task status and comments."""

    task_id: str = Field(..., description="Teamwork task ID to update")
    status: Optional[str] = Field(None, description="New status value")
    comment_body: Optional[str] = Field(None, description="Comment text to post")
    update_type: Literal["status", "comment", "progress", "completion", "error"] = Field(
        ..., description="Type of update being made"
    )
    adw_id: Optional[str] = Field(None, description="ADW ID for tracking")
    agent_name: Optional[str] = Field(None, description="Name of the agent making the update")
    session_id: Optional[str] = Field(None, description="Session ID for debugging")
    commit_hash: Optional[str] = Field(None, description="Git commit hash for completion updates")
    error_message: Optional[str] = Field(None, description="Error message for failure updates")

    def format_comment(self) -> str:
        """Format update as Teamwork comment markdown."""
        emoji_map = {
            "In Progress": "🔄",
            "Complete": "✅",
            "Failed": "❌",
            "Review": "👁️",
            "Blocked": "🚫"
        }

        emoji = emoji_map.get(self.status, "ℹ️")

        lines = [
            f"{emoji} **Status Update: {self.status}**",
            f"- **ADW ID**: {self.adw_id or 'N/A'}",
            f"- **Timestamp**: {datetime.now().isoformat()}",
        ]

        if self.commit_hash:
            lines.append(f"- **Commit Hash**: {self.commit_hash}")

        if self.agent_name:
            lines.append(f"- **Agent**: {self.agent_name}")

        lines.append("")
        lines.append("---")

        if self.error_message:
            lines.append(f"**Error**: {self.error_message}")
        elif self.comment_body:
            lines.append(self.comment_body)

        return "\n".join(lines)


class TeamworkCronConfig(BaseModel):
    """Configuration for Teamwork task monitoring cron job."""

    project_id: str = Field(..., description="Teamwork project ID")
    polling_interval: int = Field(default=15, ge=5, description="Polling interval in seconds")
    max_concurrent_tasks: int = Field(default=3, ge=1, le=10, description="Maximum concurrent tasks")
    default_model: str = Field(default="sonnet", description="Default Claude model")
    apps_directory: str = Field(default="apps", description="Target apps directory")
    worktree_base_path: str = Field(default="trees", description="Base directory for worktrees")
    dry_run: bool = Field(default=False, description="Run in dry-run mode without making changes")

    status_mapping: Dict[str, str] = Field(
        default_factory=lambda: {
            "Not started": "New",
            "In progress": "In Progress",
            "Done": "Complete",
            "HIL Review": "Review",
            "Failed": "Blocked"
        },
        description="System status to Teamwork status mapping"
    )

    status_filter: List[str] = Field(
        default_factory=lambda: ["new", "to do", "review"],
        description="Teamwork statuses to poll for (case-insensitive)"
    )
    enable_hil_review: bool = Field(
        default=True, description="Enable HIL (Human-in-the-Loop) review support"
    )

    @property
    def reverse_status_mapping(self) -> Dict[str, str]:
        """Reverse mapping from Teamwork status to system status."""
        return {v: k for k, v in self.status_mapping.items()}

    def map_status_to_teamwork(self, system_status: str) -> str:
        """Convert system status to Teamwork status."""
        return self.status_mapping.get(system_status, system_status)

    def map_status_from_teamwork(self, teamwork_status: str) -> str:
        """Convert Teamwork status to system status."""
        return self.reverse_status_mapping.get(teamwork_status, teamwork_status)

    @validator("default_model")
    def validate_default_model(cls, v):
        """Ensure default model is valid."""
        if v not in ["opus", "sonnet"]:
            raise ValueError("Default model must be 'opus' or 'sonnet'")
        return v


class TeamworkWorkflowState(BaseModel):
    """Tracks the state of a Teamwork-based workflow execution."""

    adw_id: str = Field(..., description="Unique ADW ID for this workflow")
    task_id: str = Field(..., description="Teamwork task ID")
    project_id: str = Field(..., description="Teamwork project ID")
    worktree_name: str = Field(..., description="Git worktree name")
    task_description: str = Field(..., description="Task being processed")
    workflow_type: Literal["build_update", "plan_implement_update"] = Field(
        ..., description="Type of workflow being executed"
    )
    phase: Literal[
        "starting", "planning", "implementing", "updating", "completed", "failed"
    ] = Field(..., description="Current phase of the workflow")
    model: str = Field(..., description="Claude model being used")
    started_at: datetime = Field(
        default_factory=datetime.now, description="Workflow start time"
    )
    completed_at: Optional[datetime] = Field(None, description="Workflow completion time")
    plan_path: Optional[str] = Field(None, description="Path to generated plan file")
    commit_hash: Optional[str] = Field(None, description="Final commit hash")
    error: Optional[str] = Field(None, description="Error message if workflow failed")
    teamwork_updates_count: int = Field(
        default=0, description="Number of updates sent to Teamwork"
    )

    def mark_completed(self, success: bool = True, error: Optional[str] = None, commit_hash: Optional[str] = None):
        """Mark workflow as completed."""
        self.completed_at = datetime.now()
        self.phase = "completed" if success else "failed"
        if error:
            self.error = error
        if commit_hash:
            self.commit_hash = commit_hash

    def get_duration(self) -> Optional[float]:
        """Get workflow duration in seconds."""
        if self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


class TeamworkAgentMetrics(BaseModel):
    """Metrics for monitoring Teamwork agent performance."""

    tasks_processed: int = Field(default=0, description="Total tasks processed")
    tasks_completed: int = Field(default=0, description="Tasks completed successfully")
    tasks_failed: int = Field(default=0, description="Tasks that failed")
    average_processing_time: float = Field(default=0.0, description="Average time per task")
    teamwork_api_calls: int = Field(default=0, description="Total Teamwork API calls made")
    teamwork_api_errors: int = Field(default=0, description="Teamwork API call failures")
    worktrees_created: int = Field(default=0, description="Worktrees created")
    last_reset: datetime = Field(
        default_factory=datetime.now, description="Last metrics reset time"
    )

    def success_rate(self) -> float:
        """Calculate task success rate."""
        total = self.tasks_processed
        return (self.tasks_completed / total * 100) if total > 0 else 0.0

    def api_success_rate(self) -> float:
        """Calculate Teamwork API success rate."""
        total = self.teamwork_api_calls
        return ((total - self.teamwork_api_errors) / total * 100) if total > 0 else 100.0
