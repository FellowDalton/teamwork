# Migration Plan: Replace Notion with Teamwork for Task Management

## Overview
Replace all Notion integration with Teamwork MCP server for task management, maintaining the same workflow patterns but using Teamwork's native capabilities.

## Architecture Decisions (Based on Requirements)
-  **Container**: Monitor a single Teamwork project (configurable via PROJECT_ID)
-  **Tags**: Convert inline `{{key: value}}` tags to Teamwork native tags (format: `key:value`)
-  **Updates**: Post agent outputs as task comments (preserves history, clean separation)
-  **Statuses**: Map to default Teamwork statuses (query available statuses first)

## Current Notion Integration Analysis

### Key Components
1. **MCP Integration**: Uses `@notionhq/notion-mcp-server` via `.mcp.json`
2. **Slash Commands**: `/get_notion_tasks` and `/update_notion_task`
3. **Data Models**: `NotionTask`, `NotionTaskUpdate`, `NotionCronConfig`, etc.
4. **Workflow Scripts**:
   - `adw_trigger_cron_notion_tasks.py` (polling monitor)
   - `adw_build_update_notion_task.py` (simple workflow)
   - `adw_plan_implement_update_notion_task.py` (complex workflow)

### Data Flow
```
Notion Database (tasks with status filter)
    “ (poll every 15s)
adw_trigger_cron_notion_tasks.py
    “ (fetch via /get_notion_tasks)
NotionTaskManager.get_eligible_tasks()
    “ (claim task by updating status)
NotionTaskManager.update_task_status("In progress")
    “ (spawn detached subprocess)
Workflow Script (build or plan-implement)
    “ (execute slash commands)
/plan ’ /implement ’ /update_notion_task
    “ (post results back)
Notion Page (updated with status, commit, results)
```

### Critical Features to Preserve
1. **Execution Triggers**: `execute` and `continue` in task description
2. **Inline Tags**: `{{prototype: vite_vue}}`, `{{model: opus}}`, etc.
3. **Status Flow**: Not started ’ In progress ’ Done/Failed/HIL Review
4. **Concurrency Control**: Immediate task claiming to prevent duplicates
5. **ADW ID Tracking**: Unique 8-char identifier for each execution
6. **Worktree Isolation**: Separate git worktrees per task
7. **Human-in-the-Loop**: HIL Review status with continue capability

## Implementation Phases

### Phase 1: Create Teamwork Slash Commands

#### 1.1 Create `/get_teamwork_tasks` Command
**File**: `.claude/commands/get_teamwork_tasks.md`

**Purpose**: Query tasks from a Teamwork project and prepare them for agent processing.

**Teamwork MCP Tools to Use**:
- `mcp__teamwork__twprojects-list_tasks_by_project` (primary)
- `mcp__teamwork__twprojects-get_task` (for details if needed)
- `mcp__teamwork__twprojects-list_tags` (for tag metadata)

**Parameters**:
1. `project_id` (required): Teamwork project ID to monitor
2. `status_filter` (optional): JSON array of status names, default: `["New", "To Do"]`
3. `limit` (optional): Max tasks to return, default: `10`

**Functionality**:
- Query project tasks with status filter
- Parse task description for execution triggers: `execute` or `continue - [prompt]`
- Extract Teamwork native tags (e.g., "prototype:vite_vue")
- Parse inline tags from description as fallback: `{{key: value}}`
- Combine tag sources (native tags take precedence)
- Build `task_prompt` field from description
- Return JSON array of eligible tasks

**Tag Parsing Logic**:
```javascript
// Priority order:
1. Teamwork native tags: ["prototype:vite_vue", "model:opus"]
   ’ tags.prototype = "vite_vue", tags.model = "opus"
2. Inline tags in description: "{{worktree: feat-auth}}"
   ’ tags.worktree = "feat-auth" (only if not in native tags)
```

**Execution Trigger Detection**:
- Check last line or last paragraph of description
- If ends with `execute` ’ `execution_trigger: "execute"`
- If contains `continue - <text>` ’ `execution_trigger: "continue"`, `task_prompt: "<text>"`
- Otherwise ’ skip task (not eligible)

**Response Format**:
```json
[
  {
    "task_id": "12345678",
    "title": "Build sentiment analysis UV script",
    "status": "New",
    "description": "Create a Python script that analyzes sentiment...\n\n{{prototype: uv_script}}\n\nexecute",
    "tags": {
      "prototype": "uv_script",
      "model": "opus",
      "worktree": "proto-sentiment"
    },
    "execution_trigger": "execute",
    "task_prompt": "Create a Python script that analyzes sentiment...",
    "assigned_to": null,
    "created_time": "2025-01-15T10:00:00Z",
    "due_date": null,
    "project_id": "12345"
  }
]
```

**Error Handling**:
- Invalid project_id: Return error message
- No eligible tasks: Return empty array `[]`
- API failures: Retry up to 3 times with exponential backoff
- Tag parsing errors: Log warning, continue without tags

---

#### 1.2 Create `/update_teamwork_task` Command
**File**: `.claude/commands/update_teamwork_task.md`

**Purpose**: Update Teamwork task status and post agent updates as comments.

**Teamwork MCP Tools to Use**:
- `mcp__teamwork__twprojects-update_task` (for status updates)
- `mcp__teamwork__twprojects-create_comment` (for posting updates)
- `mcp__teamwork__twprojects-create_tag` (if new tags needed)

**Parameters**:
1. `task_id` (required): Teamwork task ID
2. `status` (required): New status value (mapped from system status)
3. `update_content` (optional): JSON string with update details

**Status Mapping** (to be verified during implementation):
```javascript
System Status ’ Teamwork Status
"Not started" ’ "New" or "To Do"
"In progress" ’ "In Progress"
"Done" ’ "Complete" or "Done"
"HIL Review" ’ "Review" or "Waiting On"
"Failed" ’ "Blocked" or custom status
```

**Functionality**:
1. Parse `update_content` JSON
2. Update task status using `update_task` MCP tool
3. Format update as comment with metadata
4. Post comment using `create_comment` MCP tool
5. If commit_hash present, add as tag: `commit:<hash>`

**Comment Format**:
```markdown
=€ **Status Update: In progress**
- **ADW ID**: abc12345
- **Timestamp**: 2025-01-15T14:30:00Z
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: proto-sentiment

---
[Agent output or error details]
```

**Comment Emoji Map**:
- "In progress" ’ =€
- "Done" ’ 
- "Failed" ’ L
- "HIL Review" ’ =d
- "Blocked" ’ =«

**Example Update Content**:
```json
{
  "status": "Done",
  "adw_id": "abc12345",
  "commit_hash": "a1b2c3d4e",
  "timestamp": "2025-01-15T14:45:00Z",
  "model": "sonnet",
  "workflow": "plan-implement-update",
  "worktree_name": "proto-sentiment",
  "result": "Implementation completed successfully. Created apps/sentiment_analyzer/ with full functionality.",
  "error": ""
}
```

**Comment for Success**:
```markdown
 **Status Update: Done**
- **ADW ID**: abc12345
- **Commit Hash**: a1b2c3d4e
- **Timestamp**: 2025-01-15T14:45:00Z
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: proto-sentiment

---
**Result**: Implementation completed successfully. Created apps/sentiment_analyzer/ with full functionality.
```

**Comment for Failure**:
```markdown
L **Status Update: Failed**
- **ADW ID**: abc12345
- **Timestamp**: 2025-01-15T14:45:00Z
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: proto-sentiment

---
**Error**: Build failed: Type error in main.py line 42
```

---

### Phase 2: Update Data Models

**File**: `adws/adw_modules/data_models.py`

#### 2.1 Create `TeamworkTask` Model
Rename and adapt `NotionTask` (Lines 231-307):

```python
class TeamworkTask(BaseModel):
    """Represents a Teamwork task eligible for agent processing."""

    # Core identifiers
    task_id: str  # Changed from page_id
    project_id: str  # New field
    title: str

    # Task state
    status: Literal["New", "To Do", "In Progress", "Complete", "Review", "Blocked", "Failed"]

    # Content
    description: str  # Changed from content_blocks
    tags: Dict[str, str] = Field(default_factory=dict)

    # Metadata
    worktree: Optional[str] = None
    model: Optional[str] = None
    workflow_type: Optional[str] = None
    prototype: Optional[str] = None
    execution_trigger: Optional[str] = None
    task_prompt: Optional[str] = None

    # Teamwork-specific
    assigned_to: Optional[str] = None
    created_time: Optional[datetime] = None
    last_edited_time: Optional[datetime] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    estimated_minutes: Optional[int] = None

    def is_eligible_for_processing(self) -> bool:
        """Check if task is ready for agent processing."""
        eligible_statuses = ["New", "To Do", "Review"]  # Review = HIL Review equivalent
        return (
            self.status in eligible_statuses and
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
        if self.execution_trigger == "continue":
            # For continue, only use the continue prompt
            return self.task_prompt or ""
        else:
            # For execute, use full description minus tags and trigger
            desc = self.description
            # Remove inline tags
            desc = re.sub(r'\{\{[^}]+\}\}', '', desc)
            # Remove execute trigger
            desc = desc.replace("execute", "")
            return desc.strip()
```

#### 2.2 Create `TeamworkTaskUpdate` Model
Rename and adapt `NotionTaskUpdate` (Lines 309-346):

```python
class TeamworkTaskUpdate(BaseModel):
    """Update payload for Teamwork task status and comments."""

    task_id: str  # Changed from page_id
    status: Optional[str] = None
    comment_body: Optional[str] = None  # Changed from content_blocks
    update_type: Literal["status", "comment", "progress", "completion", "error"]

    # Metadata
    adw_id: Optional[str] = None
    agent_name: Optional[str] = None
    session_id: Optional[str] = None
    commit_hash: Optional[str] = None
    error_message: Optional[str] = None

    def format_comment(self) -> str:
        """Format update as Teamwork comment markdown."""
        emoji_map = {
            "In Progress": "=€",
            "Complete": "",
            "Failed": "L",
            "Review": "=d",
            "Blocked": "=«"
        }

        emoji = emoji_map.get(self.status, "9")

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
```

#### 2.3 Create `TeamworkCronConfig` Model
Rename and adapt `NotionCronConfig` (Lines 375-419):

```python
class TeamworkCronConfig(BaseModel):
    """Configuration for Teamwork task monitoring cron job."""

    project_id: str  # Changed from database_id
    polling_interval: int = 15  # seconds
    max_concurrent_tasks: int = 3
    default_model: str = "sonnet"
    apps_directory: str = "apps"
    worktree_base_path: str = "trees"
    dry_run: bool = False

    # Status mapping (system ’ Teamwork)
    status_mapping: Dict[str, str] = Field(default_factory=lambda: {
        "Not started": "New",
        "In progress": "In Progress",
        "Done": "Complete",
        "HIL Review": "Review",
        "Failed": "Blocked"
    })

    # Reverse mapping (Teamwork ’ system)
    @property
    def reverse_status_mapping(self) -> Dict[str, str]:
        return {v: k for k, v in self.status_mapping.items()}

    status_filter: List[str] = ["New", "To Do", "Review"]
    enable_hil_review: bool = True

    def map_status_to_teamwork(self, system_status: str) -> str:
        """Convert system status to Teamwork status."""
        return self.status_mapping.get(system_status, system_status)

    def map_status_from_teamwork(self, teamwork_status: str) -> str:
        """Convert Teamwork status to system status."""
        return self.reverse_status_mapping.get(teamwork_status, teamwork_status)
```

#### 2.4 Rename Other Models
- `NotionWorkflowState` ’ `TeamworkWorkflowState`
- `NotionAgentMetrics` ’ `TeamworkAgentMetrics`

---

### Phase 3: Update Workflow Scripts

#### 3.1 Create `adw_trigger_cron_teamwork_tasks.py`
Refactor from `adw_trigger_cron_notion_tasks.py`

**Key Changes**:

**A. Class Rename**:
```python
class TeamworkTaskManager:  # Was NotionTaskManager
    def __init__(self, config: TeamworkCronConfig):
        self.config = config
        self.project_id = config.project_id
        self.status_mapping = config.status_mapping
```

**B. Update `get_eligible_tasks()` Method** (Lines 98-180):
```python
def get_eligible_tasks(self, limit: int = 10) -> List[TeamworkTask]:
    """Fetch eligible tasks from Teamwork project."""

    # Build request for /get_teamwork_tasks
    request = AgentTemplateRequest(
        agent_name="teamwork-task-fetcher",
        slash_command="/get_teamwork_tasks",
        args=[
            self.project_id,                    # Teamwork project ID
            json.dumps(self.config.status_filter),  # ["New", "To Do", "Review"]
            str(limit)
        ],
        adw_id=generate_short_id(),
        model="sonnet",
        working_dir=os.getcwd()
    )

    # Execute via agent framework
    response = execute_template(request)

    if not response.success:
        logger.error(f"Failed to fetch Teamwork tasks: {response.error}")
        return []

    # Parse JSON response
    task_data = parse_json(response.output, list)

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

        except Exception as e:
            logger.error(f"Failed to parse task: {e}")
            continue

    return tasks
```

**C. Update `update_task_status()` Method** (Lines 182-214):
```python
def update_task_status(
    self,
    task_id: str,
    status: str,
    update_content: str = ""
) -> bool:
    """Update Teamwork task status and post comment."""

    # Map system status to Teamwork status
    teamwork_status = self.config.map_status_to_teamwork(status)

    # Build update request
    request = AgentTemplateRequest(
        agent_name="teamwork-task-updater",
        slash_command="/update_teamwork_task",
        args=[
            task_id,              # Teamwork task ID
            teamwork_status,      # Mapped status
            update_content        # JSON metadata for comment
        ],
        adw_id=generate_short_id(),
        model="sonnet",
        working_dir=os.getcwd()
    )

    # Execute update
    response = execute_template(request)

    if response.success:
        logger.info(f"Updated task {task_id} to status: {teamwork_status}")
        return True
    else:
        logger.error(f"Failed to update task {task_id}: {response.error}")
        return False
```

**D. Update `delegate_task()` Method** (Lines 327-423):
- Change `page_id` ’ `task_id`
- Pass `project_id` to workflow scripts
- Update all status references to use mapping

**E. Update Environment Variable Loading** (Lines 80-90):
```python
# Load Teamwork configuration from environment
project_id = os.getenv("TEAMWORK_PROJECT_ID")
if not project_id:
    raise ValueError("TEAMWORK_PROJECT_ID environment variable is required")

config = TeamworkCronConfig(
    project_id=project_id,
    polling_interval=int(os.getenv("TEAMWORK_POLLING_INTERVAL", "15")),
    max_concurrent_tasks=int(os.getenv("TEAMWORK_MAX_CONCURRENT_TASKS", "3")),
    dry_run=False
)
```

---

#### 3.2 Create `adw_build_update_teamwork_task.py`
Refactor from `adw_build_update_notion_task.py`

**Key Changes**:

**A. Update Main Function Signature**:
```python
def main(
    adw_id: str,
    task_id: str,      # Was page_id
    task_description: str,
    worktree_name: str,
    model: str = "sonnet",
    project_id: str = None  # New parameter
):
```

**B. Update Final Status Update** (Lines 361-481):
```python
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
    "result": build_response.output if build_response else ""
}

# Execute update
update_request = AgentTemplateRequest(
    agent_name=f"teamwork-updater-{worktree_name}",  # Changed name
    slash_command="/update_teamwork_task",            # Changed command
    args=[task_id, update_status, json.dumps(update_content)],
    adw_id=adw_id,
    model=model,
    working_dir=os.getcwd()
)
update_response = execute_template(update_request)

if update_response.success:
    logger.info(f"Successfully updated Teamwork task {task_id} to {update_status}")
else:
    logger.error(f"Failed to update Teamwork task: {update_response.error}")
```

**C. Update CLI Argument Parsing**:
```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build workflow with Teamwork task updates")
    parser.add_argument("adw_id", help="ADW execution ID")
    parser.add_argument("task_id", help="Teamwork task ID")  # Changed from page_id
    parser.add_argument("task_description", help="Task description")
    parser.add_argument("worktree_name", help="Git worktree name")
    parser.add_argument("--model", default="sonnet", help="Claude model")
    parser.add_argument("--project-id", help="Teamwork project ID")  # New

    args = parser.parse_args()
    main(args.adw_id, args.task_id, args.task_description,
         args.worktree_name, args.model, args.project_id)
```

---

#### 3.3 Create `adw_plan_implement_update_teamwork_task.py`
Refactor from `adw_plan_implement_update_notion_task.py`

**Key Changes**: Same as 3.2, but with prototype routing:

**A. Update Main Function**:
```python
def main(
    adw_id: str,
    task_id: str,      # Was page_id
    task_description: str,
    worktree_name: str,
    prototype: str = None,
    model: str = "sonnet",
    project_id: str = None  # New parameter
):
```

**B. Keep Prototype Routing Logic** (Lines 200-300):
```python
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
```

**C. Update Final Status Update** (Lines 542-666):
Same changes as 3.2, but with workflow type "plan-implement-update"

---

### Phase 4: Environment Variables

#### 4.1 Update `.env.sample`
**Remove**:
```bash
# NOTION_INTERNAL_INTEGRATION_SECRET=secret_...
# NOTION_AGENTIC_TASK_TABLE_ID=247fc382-ac73-8038-9bf6-f0727259e1a3
```

**Add**:
```bash
# Teamwork Configuration
TEAMWORK_PROJECT_ID=12345         # Required: Teamwork project ID to monitor for tasks
TEAMWORK_POLLING_INTERVAL=15      # Optional: Polling interval in seconds (default: 15)
TEAMWORK_MAX_CONCURRENT_TASKS=3   # Optional: Max parallel tasks (default: 3)

# Teamwork MCP Configuration (already in .mcp.json)
# TW_MCP_BEARER_TOKEN=tkn.v1_...
# TW_MCP_API_URL=https://deliver.fellow.dk
```

#### 4.2 Create `.env` Template
Add instructions for setup:
```bash
# Copy this file to .env and fill in your values
cp .env.sample .env

# Required: Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...

# Required: Teamwork project ID (get from Teamwork project URL)
# Example: https://deliver.fellow.dk/projects/12345
TEAMWORK_PROJECT_ID=12345

# Optional: Customize polling behavior
TEAMWORK_POLLING_INTERVAL=15
TEAMWORK_MAX_CONCURRENT_TASKS=3

# Optional: Claude Code CLI path (if not in PATH)
# CLAUDE_CODE_PATH=/usr/local/bin/claude
```

#### 4.3 Update Environment Loading in Scripts
Ensure all scripts load from `.env`:
```python
from dotenv import load_dotenv

load_dotenv()  # Load .env file

# Validate required variables
required_vars = ["ANTHROPIC_API_KEY", "TEAMWORK_PROJECT_ID"]
for var in required_vars:
    if not os.getenv(var):
        raise ValueError(f"Required environment variable {var} is not set")
```

---

### Phase 5: Tag Conversion Strategy

#### 5.1 Bidirectional Tag System

**Read Path** (Teamwork ’ System):
```python
def parse_teamwork_tags(task: Dict) -> Dict[str, str]:
    """
    Parse tags from Teamwork task.
    Priority: Native Teamwork tags > Inline description tags
    """
    tags = {}

    # 1. Parse native Teamwork tags (format: "key:value")
    if "tags" in task and task["tags"]:
        for tag in task["tags"]:
            tag_name = tag.get("name", "")
            if ":" in tag_name:
                key, value = tag_name.split(":", 1)
                tags[key.strip()] = value.strip()

    # 2. Parse inline tags from description (fallback)
    description = task.get("description", "")
    inline_tags = extract_inline_tags(description)

    # Merge (native tags take precedence)
    for key, value in inline_tags.items():
        if key not in tags:
            tags[key] = value

    return tags

def extract_inline_tags(text: str) -> Dict[str, str]:
    """Extract {{key: value}} tags from text."""
    import re
    pattern = r'\{\{(\w+):\s*([^}]+)\}\}'
    matches = re.findall(pattern, text)
    return {key: value.strip() for key, value in matches}
```

**Write Path** (System ’ Teamwork):
```python
def create_or_get_teamwork_tags(
    project_id: str,
    tags: Dict[str, str]
) -> List[int]:
    """
    Create Teamwork tags for each key:value pair.
    Returns list of tag IDs to assign to task.
    """
    tag_ids = []

    for key, value in tags.items():
        tag_name = f"{key}:{value}"

        # Check if tag exists
        existing_tags = list_tags(project_id=project_id, search_term=tag_name)

        if existing_tags:
            tag_ids.append(existing_tags[0]["id"])
        else:
            # Create new tag
            new_tag = create_tag(name=tag_name, project_id=project_id)
            tag_ids.append(new_tag["id"])

    return tag_ids
```

**Usage in Slash Command**:
```python
# In /get_teamwork_tasks command:
# After fetching task from Teamwork MCP
task_data = mcp__teamwork__twprojects_get_task(task_id)
tags = parse_teamwork_tags(task_data)

# Return in response
return {
    "task_id": task_data["id"],
    "tags": tags,  # {"prototype": "vite_vue", "model": "opus"}
    ...
}
```

#### 5.2 Standard Tag Keys

**System Tags** (preserved from Notion):
- `prototype`: Application type (uv_script, vite_vue, bun_scripts, uv_mcp)
- `model`: Claude model (opus, sonnet)
- `workflow`: Workflow type (plan, build)
- `worktree`: Custom worktree name
- `app`: Target app directory name

**Teamwork Tags** (new):
- `commit`: Git commit hash (added on completion)
- `adw`: ADW execution ID (for tracking)
- `status`: Mirror of task status for filtering

#### 5.3 Tag Creation on Task Update

When completing a task, add metadata tags:
```python
def finalize_task_with_tags(task_id: str, commit_hash: str, adw_id: str):
    """Add completion metadata as Teamwork tags."""

    # Create tags
    commit_tag = create_tag(name=f"commit:{commit_hash[:8]}")
    adw_tag = create_tag(name=f"adw:{adw_id}")

    # Get existing task tags
    task = get_task(task_id)
    existing_tag_ids = [tag["id"] for tag in task.get("tags", [])]

    # Add new tags
    all_tag_ids = existing_tag_ids + [commit_tag["id"], adw_tag["id"]]

    # Update task
    update_task(task_id=task_id, tag_ids=all_tag_ids)
```

---

### Phase 6: Status Mapping

#### 6.1 Query Available Statuses

Create initialization script to discover Teamwork statuses:

```python
def discover_teamwork_statuses(project_id: str) -> Dict[str, Any]:
    """
    Query available statuses from Teamwork and create mapping.
    Returns recommended status mapping.
    """
    # Query all statuses
    statuses = mcp__teamwork__twprojects_list_statuses()

    logger.info(f"Found {len(statuses)} Teamwork statuses:")
    for status in statuses:
        logger.info(f"  - {status['name']} (code: {status.get('code')})")

    # Attempt smart mapping
    status_names = [s["name"].lower() for s in statuses]

    mapping = {}

    # Map "Not started"
    if "new" in status_names:
        mapping["Not started"] = "New"
    elif "to do" in status_names or "todo" in status_names:
        mapping["Not started"] = "To Do"
    else:
        mapping["Not started"] = statuses[0]["name"]  # Default to first

    # Map "In progress"
    if "in progress" in status_names:
        mapping["In progress"] = "In Progress"
    elif "active" in status_names:
        mapping["In progress"] = "Active"
    elif "working" in status_names:
        mapping["In progress"] = "Working"
    else:
        mapping["In progress"] = statuses[1]["name"] if len(statuses) > 1 else statuses[0]["name"]

    # Map "Done"
    if "complete" in status_names or "completed" in status_names:
        mapping["Done"] = "Complete"
    elif "done" in status_names:
        mapping["Done"] = "Done"
    elif "closed" in status_names:
        mapping["Done"] = "Closed"
    else:
        mapping["Done"] = statuses[-1]["name"]  # Default to last

    # Map "HIL Review"
    if "review" in status_names:
        mapping["HIL Review"] = "Review"
    elif "waiting" in status_names or "waiting on" in status_names:
        mapping["HIL Review"] = "Waiting On"
    elif "pending" in status_names:
        mapping["HIL Review"] = "Pending"
    else:
        mapping["HIL Review"] = mapping["In progress"]  # Fallback

    # Map "Failed"
    if "blocked" in status_names:
        mapping["Failed"] = "Blocked"
    elif "failed" in status_names:
        mapping["Failed"] = "Failed"
    elif "error" in status_names:
        mapping["Failed"] = "Error"
    else:
        # Create custom status if possible
        try:
            new_status = mcp__teamwork__twprojects_create_status(
                name="Failed",
                color="#ff0000"
            )
            mapping["Failed"] = "Failed"
        except:
            mapping["Failed"] = mapping["In progress"]  # Fallback

    return {
        "available_statuses": statuses,
        "recommended_mapping": mapping
    }
```

#### 6.2 Configuration Override

Allow manual status mapping in config:
```python
class TeamworkCronConfig(BaseModel):
    # ... other fields ...

    # Default mapping (can be overridden)
    status_mapping: Dict[str, str] = Field(default_factory=lambda: {
        "Not started": "New",
        "In progress": "In Progress",
        "Done": "Complete",
        "HIL Review": "Review",
        "Failed": "Blocked"
    })

    @classmethod
    def from_env_with_status_discovery(cls, project_id: str):
        """Create config with auto-discovered statuses."""
        mapping_info = discover_teamwork_statuses(project_id)

        return cls(
            project_id=project_id,
            status_mapping=mapping_info["recommended_mapping"]
        )
```

#### 6.3 Status Mapping in Commands

Update `/get_teamwork_tasks` to normalize statuses:
```python
# In command implementation
def normalize_status(teamwork_status: str, reverse_mapping: Dict[str, str]) -> str:
    """Convert Teamwork status to system status."""
    return reverse_mapping.get(teamwork_status, teamwork_status)

# Usage
task_data = {
    "task_id": "12345",
    "status": normalize_status(tw_task["status"], config.reverse_status_mapping),
    ...
}
```

---

### Phase 7: Comment Format and Posting

#### 7.1 Comment Structure

**Standard Comment Template**:
```python
def format_agent_comment(
    status: str,
    adw_id: str,
    metadata: Dict[str, Any],
    body: str = ""
) -> str:
    """Format agent update as Teamwork comment."""

    emoji_map = {
        "In Progress": "=€",
        "Complete": "",
        "Failed": "L",
        "Review": "=d",
        "Blocked": "=«"
    }

    emoji = emoji_map.get(status, "9")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        f"{emoji} **Status Update: {status}**",
        f"- **ADW ID**: `{adw_id}`",
        f"- **Timestamp**: {timestamp}",
    ]

    # Add optional metadata
    if metadata.get("commit_hash"):
        lines.append(f"- **Commit**: `{metadata['commit_hash']}`")

    if metadata.get("model"):
        lines.append(f"- **Model**: {metadata['model']}")

    if metadata.get("workflow"):
        lines.append(f"- **Workflow**: {metadata['workflow']}")

    if metadata.get("worktree_name"):
        lines.append(f"- **Worktree**: `{metadata['worktree_name']}`")

    # Add separator
    lines.append("")
    lines.append("---")
    lines.append("")

    # Add body content
    if body:
        lines.append(body)

    return "\n".join(lines)
```

#### 7.2 Comment Types

**1. Start Comment** (when claiming task):
```markdown
=€ **Status Update: In Progress**
- **ADW ID**: `abc12345`
- **Timestamp**: 2025-01-15 14:30:00 UTC
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

Task claimed by agent. Starting workflow execution...
```

**2. Success Comment** (when completed):
```markdown
 **Status Update: Complete**
- **ADW ID**: `abc12345`
- **Timestamp**: 2025-01-15 14:45:00 UTC
- **Commit**: `a1b2c3d4`
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

**Implementation Summary**:
Created `apps/sentiment_analyzer/` with the following features:
- Python UV script with inline dependencies
- Sentiment analysis using TextBlob
- CLI with argparse for multiple input methods
- Output formatting (JSON, CSV, text)
- Error handling and logging

**Files Created**:
- `apps/sentiment_analyzer/main.py` (main script)
- `apps/sentiment_analyzer/README.md` (usage docs)

**Commit**: `a1b2c3d4e5f6g7h8` on branch `proto-sentiment`
```

**3. Error Comment** (when failed):
```markdown
L **Status Update: Blocked**
- **ADW ID**: `abc12345`
- **Timestamp**: 2025-01-15 14:45:00 UTC
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

**Error During Implementation**:

```
TypeError: unsupported operand type(s) for +: 'int' and 'str'
  File "apps/sentiment_analyzer/main.py", line 42, in analyze
    score = sentiment.polarity + rating
```

**Next Steps**:
1. Review error in worktree: `trees/proto-sentiment/`
2. Check implementation plan: `specs/plan-sentiment-analyzer.md`
3. Update task with continue prompt if needed
```

**4. HIL Review Comment** (requesting human input):
```markdown
=d **Status Update: Review**
- **ADW ID**: `abc12345`
- **Timestamp**: 2025-01-15 14:45:00 UTC
- **Commit**: `a1b2c3d4`
- **Model**: sonnet
- **Workflow**: plan-implement-update
- **Worktree**: `proto-sentiment`

---

**Implementation Complete - Please Review**:

The sentiment analyzer has been implemented with all requested features. Please review:

1. **Test the application**:
   ```bash
   cd apps/sentiment_analyzer
   uv run ./main.py "I love this product!"
   ```

2. **Review the code**: Check `apps/sentiment_analyzer/main.py`

3. **Provide feedback**:
   - If approved, update status to "Complete"
   - If changes needed, update task description with:
     ```
     continue - Add support for multiple languages
     ```

**Current Implementation**:
-  Basic sentiment analysis working
-  CLI interface functional
-  Output formatting (JSON/CSV/text)
-   No language detection yet
-   No batch processing
```

#### 7.3 Posting Comments via MCP

Implementation in `/update_teamwork_task`:
```python
def post_comment_to_task(task_id: str, comment_body: str) -> bool:
    """Post formatted comment to Teamwork task."""

    try:
        result = mcp__teamwork__twprojects_create_comment(
            object={
                "type": "tasks",
                "id": int(task_id)
            },
            body=comment_body,
            content_type="TEXT"  # or "HTML" if Teamwork supports it
        )

        logger.info(f"Posted comment to task {task_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to post comment: {e}")
        return False
```

---

### Phase 8: Testing Plan

#### 8.1 Unit Tests

**File**: `tests/test_teamwork_integration.py`

**Test Cases**:

```python
import pytest
from adws.adw_modules.data_models import TeamworkTask, TeamworkCronConfig

def test_tag_parsing():
    """Test inline tag extraction from description."""
    description = """
    Build a sentiment analyzer

    {{prototype: uv_script}}
    {{model: opus}}
    {{worktree: feat-sentiment}}

    execute
    """

    task = TeamworkTask(
        task_id="12345",
        project_id="100",
        title="Test",
        status="New",
        description=description,
        tags={}
    )

    inline_tags = task.extract_tags_from_description()
    assert inline_tags["prototype"] == "uv_script"
    assert inline_tags["model"] == "opus"
    assert inline_tags["worktree"] == "feat-sentiment"

def test_status_mapping():
    """Test bidirectional status mapping."""
    config = TeamworkCronConfig(
        project_id="100",
        status_mapping={
            "Not started": "New",
            "In progress": "In Progress",
            "Done": "Complete"
        }
    )

    # System ’ Teamwork
    assert config.map_status_to_teamwork("Not started") == "New"
    assert config.map_status_to_teamwork("In progress") == "In Progress"

    # Teamwork ’ System
    assert config.map_status_from_teamwork("New") == "Not started"
    assert config.map_status_from_teamwork("In Progress") == "In progress"

def test_execution_trigger_detection():
    """Test execute vs continue trigger parsing."""

    # Test execute
    task1 = TeamworkTask(
        task_id="1",
        project_id="100",
        title="Test",
        status="New",
        description="Build something\n\nexecute",
        tags={},
        execution_trigger="execute"
    )
    assert task1.is_eligible_for_processing()

    # Test continue
    task2 = TeamworkTask(
        task_id="2",
        project_id="100",
        title="Test",
        status="Review",
        description="continue - Add error handling",
        tags={},
        execution_trigger="continue",
        task_prompt="Add error handling"
    )
    assert task2.is_eligible_for_processing()

    # Test ineligible
    task3 = TeamworkTask(
        task_id="3",
        project_id="100",
        title="Test",
        status="New",
        description="No trigger here",
        tags={},
        execution_trigger=None
    )
    assert not task3.is_eligible_for_processing()

def test_comment_formatting():
    """Test comment generation with different statuses."""
    from adws.adw_modules.data_models import TeamworkTaskUpdate

    update = TeamworkTaskUpdate(
        task_id="12345",
        status="Complete",
        update_type="completion",
        adw_id="abc12345",
        commit_hash="a1b2c3d4",
        comment_body="Implementation completed successfully"
    )

    comment = update.format_comment()

    assert "" in comment
    assert "abc12345" in comment
    assert "a1b2c3d4" in comment
    assert "Implementation completed successfully" in comment
```

#### 8.2 Integration Tests

**Test Scenario 1**: Fetch Tasks
```bash
# Create test task in Teamwork with:
# - Status: "New"
# - Description: "Test task\n\n{{prototype: uv_script}}\n\nexecute"

# Run fetcher
python -c "
from adws.adw_modules.agent import execute_template, AgentTemplateRequest
result = execute_template(AgentTemplateRequest(
    agent_name='test-fetcher',
    slash_command='/get_teamwork_tasks',
    args=['YOUR_PROJECT_ID', '[\"New\"]', '10'],
    adw_id='test123'
))
print(result.output)
"

# Verify:
# - Task is returned
# - Tags are parsed correctly
# - Execution trigger detected
```

**Test Scenario 2**: Update Task
```bash
# Update the test task
python -c "
from adws.adw_modules.agent import execute_template, AgentTemplateRequest
import json

update_content = json.dumps({
    'adw_id': 'test123',
    'commit_hash': 'abcd1234',
    'model': 'sonnet'
})

result = execute_template(AgentTemplateRequest(
    agent_name='test-updater',
    slash_command='/update_teamwork_task',
    args=['YOUR_TASK_ID', 'Complete', update_content],
    adw_id='test123'
))
print(result.output)
"

# Verify in Teamwork:
# - Status changed to "Complete"
# - Comment posted with metadata
# - Timestamp is correct
```

#### 8.3 End-to-End Test

**Full Workflow Test**:
```bash
# 1. Create test task in Teamwork:
#    Title: "E2E Test: Build Hello World UV Script"
#    Description:
#      Create a simple Python UV script that prints "Hello, World!"
#
#      {{prototype: uv_script}}
#      {{app: hello_world}}
#
#      execute
#    Status: "New"

# 2. Run monitor once
./adws/adw_trigger_cron_teamwork_tasks.py --once

# 3. Monitor execution
tail -f agents/*/*/cc_raw_output.jsonl

# 4. Verify results:
# - Task status updated to "In Progress" immediately
# - Worktree created: trees/proto-hello-world/
# - Plan generated: specs/plan-hello-world.md
# - App created: apps/hello_world/main.py
# - Git commit created
# - Task status updated to "Complete"
# - Comment posted with commit hash

# 5. Test the generated app
cd apps/hello_world
uv run ./main.py
# Expected output: Hello, World!

# 6. Verify comment in Teamwork
# Should contain:
# -  Complete status
# - ADW ID
# - Commit hash
# - Summary of implementation
```

#### 8.4 Parallel Execution Test

**Test Concurrent Tasks**:
```bash
# 1. Create 3 test tasks in Teamwork simultaneously
# 2. Set all to status "New" with execute trigger
# 3. Run monitor: ./adws/adw_trigger_cron_teamwork_tasks.py --max-tasks 3
# 4. Verify:
#    - All 3 tasks claimed immediately (no race condition)
#    - All 3 execute in parallel
#    - All 3 complete without conflicts
#    - No duplicate ADW IDs
```

#### 8.5 HIL Review Test

**Test Human-in-the-Loop Flow**:
```bash
# 1. Create task that will need review:
#    Description:
#      Build a calculator but request review before completion
#
#      {{prototype: uv_script}}
#
#      execute

# 2. Modify workflow to set status to "Review" instead of "Complete"
# 3. Monitor executes and posts HIL Review comment
# 4. Manually add to task description:
#    continue - Add support for square root operation
# 5. Run monitor again
# 6. Verify:
#    - Task picked up from "Review" status
#    - Only the continue prompt is passed to agent
#    - Implementation updated with new feature
#    - Final status set to "Complete"
```

---

### Phase 9: Documentation Updates

#### 9.1 Update `CLAUDE.md`

**Section Changes**:

**A. Project Overview** (Lines 5-20):
```markdown
TAC8 App4 is a **multi-agent rapid prototyping system** that monitors Teamwork
projects for prototype requests and automatically generates complete applications
using AI agents. The system uses isolated git worktrees for parallel development
and specialized planning agents for different technology stacks.

### Key Concepts

- **Teamwork-Based Task Management**: Tasks are defined in Teamwork with status
  tracking, execution triggers, and tags
- **Worktree Isolation**: Each task gets its own git worktree with sparse checkout
  for parallel development
- **Multi-Agent Workflows**: Tasks are routed to different workflows based on tags
- **Specialized Planners**: Framework-specific `/plan_[prototype]` commands generate
  comprehensive implementation plans
- **Detached Execution**: Agents run as detached subprocesses for true parallelism
```

**B. Development Commands** (Lines 22-60):
```markdown
### Running the System

```bash
# Start the Teamwork task monitor (polls every 15 seconds)
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py

# Run once and exit (no continuous monitoring)
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once

# Dry run mode (no changes, just logging)
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --dry-run

# Custom polling interval (in seconds)
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --interval 30

# Limit concurrent tasks
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --max-tasks 5
```
```

**C. Core Data Flow** (Lines 100-110):
```markdown
1. **Trigger**: `adw_trigger_cron_teamwork_tasks.py` polls Teamwork every 15 seconds
2. **Detection**: Identifies tasks with status "New"/"To Do" or "Review" + `execute` trigger
3. **Claiming**: Updates status to "In Progress" with ADW ID to prevent duplicate work
4. **Routing**: Routes to workflow based on `prototype:type` or `workflow:plan` tags
5. **Execution**: Spawns detached subprocess running workflow ADW script
...
```

**D. Environment Setup** (Lines 400-450):
```markdown
### Required Environment Variables (.env)

```bash
# Anthropic API key (required)
ANTHROPIC_API_KEY=sk-ant-...

# Teamwork project ID for task tracking (required)
TEAMWORK_PROJECT_ID=12345

# Teamwork MCP configuration (in .mcp.json)
# TW_MCP_BEARER_TOKEN=tkn.v1_...
# TW_MCP_API_URL=https://deliver.fellow.dk

# Claude Code CLI path (optional, defaults to "claude")
CLAUDE_CODE_PATH=/path/to/claude
```
```

**E. Teamwork Task Tags** (Lines 200-220):
```markdown
### Teamwork Task Tags

Tasks in Teamwork support tags that control execution:

**Native Tags** (applied in Teamwork UI):
- `prototype:vite_vue` - Generate a Vue.js application
- `prototype:uv_script` - Generate Python UV script
- `prototype:bun_scripts` - Generate Bun TypeScript app
- `prototype:uv_mcp` - Generate MCP server
- `model:opus` - Use Claude Opus instead of Sonnet
- `workflow:plan` - Force plan-implement workflow
- `worktree:feat-auth` - Custom worktree name
- `app:my-app` - Custom app directory name

**Inline Tags** (in task description, backward compatible):
```
{{prototype: vite_vue}}
{{model: opus}}
```

**Execution Triggers** (in task description):
Tasks must have one of these in their description:
- `execute` - Start fresh execution (at end of description)
- `continue - <prompt>` - Pick up from "Review" status with new instructions
```

#### 9.2 Update `README.md`

**Replace Notion References**:

**Before**:
```markdown
## Prerequisites
- Python 3.9+ with UV
- Notion account with integration secret
- Notion database for task tracking
```

**After**:
```markdown
## Prerequisites
- Python 3.9+ with UV
- Teamwork account with API access
- Teamwork project for task tracking
- Bun runtime (for Vue.js and TypeScript prototypes)
```

**Setup Section**:
```markdown
## Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd tac8_app4__agentic_prototyping
   ```

2. **Install dependencies**
   ```bash
   # Python dependencies (UV will handle automatically)
   curl -LsSf https://astral.sh/uv/install.sh | sh

   # Bun runtime
   curl -fsSL https://bun.sh/install | bash

   # Claude Code CLI
   # Follow instructions at https://claude.com/code
   ```

3. **Configure environment variables**
   ```bash
   cp .env.sample .env
   # Edit .env and fill in:
   # - ANTHROPIC_API_KEY
   # - TEAMWORK_PROJECT_ID
   ```

4. **Configure Teamwork MCP**
   Edit `.mcp.json` and update:
   ```json
   {
     "mcpServers": {
       "teamwork": {
         "env": {
           "TW_MCP_BEARER_TOKEN": "your-token",
           "TW_MCP_API_URL": "https://your-site.teamwork.com"
         }
       }
     }
   }
   ```

5. **Create task statuses in Teamwork** (if needed)
   Ensure your project has these statuses:
   - "New" or "To Do" (for new tasks)
   - "In Progress" (for active tasks)
   - "Complete" or "Done" (for finished tasks)
   - "Review" (for human-in-the-loop)
   - "Blocked" (for failed tasks)

6. **Start the monitor**
   ```bash
   ./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py
   ```
```

**Usage Section**:
```markdown
## Usage

### Creating a Task

1. **Go to your Teamwork project**
2. **Create a new task**:
   - **Title**: Brief description (e.g., "Build sentiment analyzer")
   - **Description**:
     ```
     Create a Python UV script that analyzes sentiment of text input.
     Should support multiple input methods (file, stdin, args).

     execute
     ```
   - **Tags**: Add `prototype:uv_script` tag
   - **Status**: Set to "New"

3. **Monitor will pick it up** within 15 seconds
4. **Check progress**:
   - Task status updates to "In Progress" immediately
   - Comments posted with execution updates
   - Final comment includes commit hash and summary

### Task Tags

Control execution with Teamwork tags:

| Tag | Purpose | Example |
|-----|---------|---------|
| `prototype:uv_script` | Python CLI tool | Single-file executable |
| `prototype:vite_vue` | Vue.js web app | Full frontend application |
| `prototype:bun_scripts` | TypeScript backend | Bun runtime service |
| `prototype:uv_mcp` | MCP server | Claude integration |
| `model:opus` | Use Claude Opus | Higher quality, slower |
| `workflow:plan` | Force planning phase | Complex features |
| `worktree:name` | Custom branch name | `feat-authentication` |
| `app:name` | Custom app directory | `my_sentiment_app` |

### Human-in-the-Loop Review

1. **Task completes** with status "Review"
2. **Review the output**:
   - Check generated code in `apps/` directory
   - Test the application
   - Review the commit in the worktree

3. **Provide feedback**:
   - If approved: Manually set status to "Complete"
   - If changes needed: Add to description:
     ```
     continue - Add error handling for invalid input
     ```
   - Set status back to "Review"
   - Monitor will pick it up and continue

### Monitoring Tasks

```bash
# View running tasks
ps aux | grep adw_trigger_cron_teamwork_tasks

# Check agent outputs
ls -la agents/
cat agents/<adw-id>/*/cc_raw_output.jsonl

# View worktrees
git worktree list

# Check generated apps
ls -la apps/
```
```

#### 9.3 Create `docs/MIGRATION.md`

**New File**: `docs/MIGRATION.md`

```markdown
# Migration Guide: Notion to Teamwork

This guide helps you migrate from Notion-based task management to Teamwork.

## Overview

The migration involves:
1. Exporting existing tasks from Notion
2. Creating equivalent tasks in Teamwork
3. Updating environment configuration
4. Verifying the new system works

## Prerequisites

- Access to Notion workspace with existing tasks
- Teamwork account with project creation access
- Teamwork API bearer token
- Python 3.9+ with UV installed

## Step 1: Export Notion Tasks

### Option A: Manual Export

1. Open your Notion task database
2. For each active task, note:
   - Title
   - Status
   - Description/content
   - Any inline tags (`{{key: value}}`)
   - Execution trigger status

### Option B: Automated Export (if available)

```bash
# Use Notion API to export tasks
python scripts/export_notion_tasks.py \
  --database-id YOUR_NOTION_DB_ID \
  --output notion_tasks.json
```

## Step 2: Set Up Teamwork

### 2.1 Create Project

1. Log into Teamwork
2. Create new project: "TAC8 Agentic Prototyping"
3. Note the project ID from URL: `https://site.teamwork.com/projects/12345`

### 2.2 Configure Statuses

Ensure these statuses exist in your project:

| System Status | Teamwork Status (default) | Create if Missing |
|---------------|---------------------------|-------------------|
| Not started | New or To Do |  |
| In progress | In Progress |  |
| Done | Complete or Done |  |
| HIL Review | Review or Waiting On |  |
| Failed | Blocked |  |

**To create custom status**:
1. Go to Project Settings ’ Task Statuses
2. Click "Add Status"
3. Name: "Review" (for HIL)
4. Color: Yellow/Orange
5. Save

### 2.3 Set Up Tags

Create tag template for prototypes:
1. Go to Project Settings ’ Tags
2. Create tags:
   - `prototype:uv_script`
   - `prototype:vite_vue`
   - `prototype:bun_scripts`
   - `prototype:uv_mcp`
   - `model:opus`
   - `model:sonnet`
   - `workflow:plan`

## Step 3: Import Tasks to Teamwork

### Manual Import

For each Notion task:

1. **Create new Teamwork task**
2. **Set title**: Same as Notion
3. **Set description**:
   - Copy content from Notion
   - Keep inline tags if present (backward compatible)
   - Add execution trigger at end: `execute`
4. **Add tags**: Convert inline tags to native Teamwork tags
   - `{{prototype: vite_vue}}` ’ Add tag `prototype:vite_vue`
5. **Set status**: Map from Notion status
   - "Not started" ’ "New"
   - "In progress" ’ Skip (will be reclaimed)
   - "Done" ’ "Complete"
   - "HIL Review" ’ "Review"

### Automated Import (if available)

```bash
python scripts/import_to_teamwork.py \
  --input notion_tasks.json \
  --project-id 12345 \
  --dry-run  # Test first

# After verifying dry run:
python scripts/import_to_teamwork.py \
  --input notion_tasks.json \
  --project-id 12345
```

## Step 4: Update Configuration

### 4.1 Environment Variables

Edit `.env`:

**Remove**:
```bash
# NOTION_INTERNAL_INTEGRATION_SECRET=...
# NOTION_AGENTIC_TASK_TABLE_ID=...
```

**Add**:
```bash
# Teamwork Configuration
TEAMWORK_PROJECT_ID=12345
TEAMWORK_POLLING_INTERVAL=15
TEAMWORK_MAX_CONCURRENT_TASKS=3
```

### 4.2 MCP Configuration

Verify `.mcp.json` has Teamwork configured:

```json
{
  "mcpServers": {
    "teamwork": {
      "command": "go",
      "args": [
        "run",
        "-C",
        "/path/to/teamwork-mcp",
        "cmd/mcp-stdio/main.go"
      ],
      "env": {
        "TW_MCP_BEARER_TOKEN": "your-token",
        "TW_MCP_API_URL": "https://your-site.teamwork.com"
      }
    }
  }
}
```

**Get your bearer token**:
1. Log into Teamwork
2. Go to Settings ’ API & Mobile ’ API Token
3. Copy token (format: `tkn.v1_...`)

## Step 5: Test the Migration

### 5.1 Test Task Fetching

```bash
# Test /get_teamwork_tasks command
claude /get_teamwork_tasks 12345 '["New"]' 5

# Expected output: JSON array of tasks
# Verify:
# - Tasks are fetched
# - Tags are parsed correctly
# - Execution triggers detected
```

### 5.2 Test Status Update

```bash
# Create test task in Teamwork:
# Title: "Migration Test"
# Description: "Test task\n\nexecute"
# Status: "New"

# Test /update_teamwork_task command
claude /update_teamwork_task YOUR_TASK_ID "In Progress" '{"adw_id": "test123"}'

# Verify in Teamwork:
# - Status changed to "In Progress"
# - Comment posted with ADW ID
```

### 5.3 Test Full Workflow

```bash
# Create real task:
# Title: "Migration E2E Test"
# Description:
#   Create a simple hello world UV script
#
#   {{prototype: uv_script}}
#
#   execute
# Tags: prototype:uv_script
# Status: "New"

# Run monitor once
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once

# Wait for completion (check Teamwork for updates)

# Verify:
# - Task claimed (status ’ "In Progress")
# - Worktree created
# - App generated in apps/
# - Final status "Complete"
# - Comment with commit hash
```

## Step 6: Parallel Operation (Optional)

You can run both systems in parallel during migration:

### Keep Notion Monitor Running

```bash
# Terminal 1: Notion monitor
./adws/adw_triggers/adw_trigger_cron_notion_tasks.py
```

### Start Teamwork Monitor

```bash
# Terminal 2: Teamwork monitor
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py
```

### Gradual Migration

1. **Week 1**: Test Teamwork with low-priority tasks
2. **Week 2**: Move half of tasks to Teamwork
3. **Week 3**: Move all new tasks to Teamwork
4. **Week 4**: Migrate remaining Notion tasks
5. **Week 5**: Shut down Notion monitor

## Step 7: Cleanup

Once migration is complete:

### Remove Notion Files

```bash
# Backup first
mkdir backup_notion
mv adws/adw_trigger_cron_notion_tasks.py backup_notion/
mv adws/adw_build_update_notion_task.py backup_notion/
mv adws/adw_plan_implement_update_notion_task.py backup_notion/
mv .claude/commands/get_notion_tasks.md backup_notion/
mv .claude/commands/update_notion_task.md backup_notion/

# After confirming Teamwork works, delete backups
rm -rf backup_notion/
```

### Remove from MCP Config

Edit `.mcp.json` and remove:
```json
{
  "mcpServers": {
    // Remove this:
    // "notionApi": { ... }
  }
}
```

### Update Git Ignores

Edit `.gitignore` if needed:
```
# Old Notion artifacts (can remove)
# agents/**/notion-*
```

## Troubleshooting

### Tasks Not Being Picked Up

**Problem**: Teamwork tasks with "execute" trigger not processing

**Solutions**:
1. Check project ID: `echo $TEAMWORK_PROJECT_ID`
2. Verify task status is in filter: "New", "To Do", or "Review"
3. Check execution trigger is at end of description
4. Review monitor logs: `./adw_trigger_cron_teamwork_tasks.py --once`

### Status Mapping Issues

**Problem**: Status updates failing or wrong status displayed

**Solutions**:
1. Query available statuses:
   ```bash
   claude /list_teamwork_statuses
   ```
2. Update mapping in `.env`:
   ```bash
   TEAMWORK_STATUS_MAPPING='{"Not started":"To Do","In progress":"Active"}'
   ```
3. Restart monitor

### Tag Parsing Errors

**Problem**: Tags not recognized from description

**Solutions**:
1. Use native Teamwork tags instead of inline
2. Check tag format: `{{key: value}}` (with space after colon)
3. Verify tags are applied in Teamwork UI
4. Check agent logs: `cat agents/*/teamwork-task-fetcher/cc_raw_output.jsonl`

### Comment Posting Failures

**Problem**: Status updates but no comments posted

**Solutions**:
1. Check Teamwork permissions (API token needs comment access)
2. Verify MCP server is running: `ps aux | grep teamwork-mcp`
3. Test comment manually:
   ```bash
   claude /create_teamwork_comment YOUR_TASK_ID "Test comment"
   ```
4. Check for MCP errors in Claude Code logs

## Rollback Procedure

If you need to revert to Notion:

### Quick Rollback

```bash
# 1. Stop Teamwork monitor
pkill -f adw_trigger_cron_teamwork_tasks

# 2. Restore Notion files
git checkout main -- adws/adw_trigger_cron_notion_tasks.py
git checkout main -- adws/adw_build_update_notion_task.py
git checkout main -- adws/adw_plan_implement_update_notion_task.py
git checkout main -- .claude/commands/get_notion_tasks.md
git checkout main -- .claude/commands/update_notion_task.md

# 3. Restore .env
# Remove: TEAMWORK_PROJECT_ID
# Add back: NOTION_AGENTIC_TASK_TABLE_ID

# 4. Restart Notion monitor
./adws/adw_triggers/adw_trigger_cron_notion_tasks.py
```

### Full Rollback

```bash
# Reset to pre-migration commit
git log --oneline | grep "Before Teamwork migration"
git reset --hard <commit-hash>
```

## Support

If you encounter issues:

1. Check logs: `agents/**/*/cc_raw_output.jsonl`
2. Review this guide's troubleshooting section
3. Test commands individually (use `--once` flag)
4. Verify MCP configuration: `.mcp.json`
5. Check Teamwork API status: https://www.teamwork.com/status

## Post-Migration Checklist

- [ ] All active Notion tasks migrated to Teamwork
- [ ] Teamwork monitor running and processing tasks
- [ ] Test task completed successfully end-to-end
- [ ] HIL review flow tested and working
- [ ] Parallel execution tested (3+ tasks simultaneously)
- [ ] Documentation updated (CLAUDE.md, README.md)
- [ ] Team trained on new Teamwork-based workflow
- [ ] Notion monitor stopped and files removed
- [ ] Backup of Notion data taken (if needed)
- [ ] Rollback procedure documented and tested

**Congratulations!** You've successfully migrated to Teamwork-based task management.
```

---

### Phase 10: Implementation Order

**Recommended execution order**:

1.  **Phase 1**: Create slash commands (`/get_teamwork_tasks`, `/update_teamwork_task`)
   - Test individually with real Teamwork project
   - Verify MCP tool calls work correctly

2.  **Phase 2**: Update data models
   - Rename classes: `Notion*` ’ `Teamwork*`
   - Add new fields (project_id, etc.)
   - Test serialization/deserialization

3.  **Phase 4**: Update environment variables
   - Update `.env.sample`
   - Create setup instructions
   - Test environment loading

4.  **Phase 5**: Implement tag conversion
   - Test bidirectional parsing
   - Test tag creation in Teamwork
   - Verify native + inline tag priority

5.  **Phase 6**: Implement status mapping
   - Query available Teamwork statuses
   - Create mapping configuration
   - Test status updates both directions

6.  **Phase 7**: Implement comment formatting
   - Create comment templates
   - Test posting to Teamwork
   - Verify markdown rendering

7.  **Phase 3**: Update workflow scripts
   - Start with simpler `adw_build_update_teamwork_task.py`
   - Then `adw_plan_implement_update_teamwork_task.py`
   - Finally `adw_trigger_cron_teamwork_tasks.py`

8.  **Phase 8**: Testing
   - Unit tests for each component
   - Integration tests for MCP calls
   - E2E test with real task
   - Parallel execution test
   - HIL review flow test

9.  **Phase 9**: Documentation
   - Update CLAUDE.md
   - Update README.md
   - Create MIGRATION.md

10.  **Production Rollout**:
    - Test with single task
    - Monitor for 24 hours
    - Scale to full usage
    - Deprecate Notion integration

---

## Risk Mitigation

### Potential Issues

**1. Teamwork MCP Compatibility**
- **Risk**: MCP tools may have different signatures than expected
- **Mitigation**: Test all MCP calls early in Phase 1
- **Fallback**: Adjust data models to match actual MCP responses

**2. Status Mapping Inconsistency**
- **Risk**: Teamwork statuses may not map cleanly to system statuses
- **Mitigation**: Query available statuses first, create custom if needed
- **Fallback**: Use closest matches and log warnings

**3. Tag System Complexity**
- **Risk**: Native tags + inline tags may cause confusion
- **Mitigation**: Document priority clearly, test extensively
- **Fallback**: Use only native tags, remove inline support

**4. Comment Formatting Limitations**
- **Risk**: Teamwork may not support markdown in comments
- **Mitigation**: Test comment rendering early
- **Fallback**: Use plain text with structure (headers, bullets)

**5. Race Conditions in Task Claiming**
- **Risk**: Multiple monitors may claim same task
- **Mitigation**: Immediate status update on claim (same as Notion)
- **Fallback**: Add distributed lock using task tags

**6. Performance Degradation**
- **Risk**: Teamwork API may be slower than Notion
- **Mitigation**: Test polling performance, adjust interval if needed
- **Fallback**: Implement caching layer for task lists

### Rollback Plan

At any point, can revert to Notion:
1. Stop Teamwork monitor
2. Restore Notion scripts from git
3. Update `.env` back to Notion config
4. Restart Notion monitor

**No data loss** - all git commits and worktrees preserved.

---

## Success Metrics

**Phase 1 Success**:
- [ ] `/get_teamwork_tasks` returns valid task JSON
- [ ] `/update_teamwork_task` updates status and posts comment
- [ ] Tags parsed correctly from both native and inline

**Phase 3 Success**:
- [ ] Monitor fetches tasks from Teamwork every 15s
- [ ] Tasks claimed immediately (no duplicates)
- [ ] Status updates visible in Teamwork
- [ ] Comments posted with proper formatting

**Phase 8 Success**:
- [ ] E2E test completes: task ’ worktree ’ build ’ commit ’ update
- [ ] Parallel test: 3 tasks execute simultaneously without conflicts
- [ ] HIL test: continue flow works correctly
- [ ] All unit tests pass

**Production Success** (after 1 week):
- [ ] 95%+ tasks complete successfully
- [ ] <5% duplicate task processing
- [ ] <1% race conditions
- [ ] Average task time comparable to Notion
- [ ] No manual intervention required for typical tasks

---

## Timeline

**Conservative Estimate** (with testing):

| Phase | Description | Time | Cumulative |
|-------|-------------|------|------------|
| 1 | Slash commands | 3 hours | 3h |
| 2 | Data models | 2 hours | 5h |
| 4 | Environment | 1 hour | 6h |
| 5 | Tag conversion | 2 hours | 8h |
| 6 | Status mapping | 2 hours | 10h |
| 7 | Comment format | 2 hours | 12h |
| 3 | Workflow scripts | 4 hours | 16h |
| 8 | Testing | 4 hours | 20h |
| 9 | Documentation | 2 hours | 22h |
| 10 | Rollout | 2 hours | 24h |

**Aggressive Estimate** (minimal testing):
- ~12-15 hours (skip extensive testing, rollout immediately)

**Recommended Approach**:
- **Week 1**: Phases 1-7 (implementation)
- **Week 2**: Phase 8 (testing) + Phase 9 (docs)
- **Week 3**: Phase 10 (production rollout with monitoring)

---

## Next Steps

Once you approve this plan:

1. **Start with Phase 1**: Create `/get_teamwork_tasks` command
2. **Test immediately**: Verify MCP calls work with your Teamwork instance
3. **Iterate**: Adjust based on actual Teamwork API behavior
4. **Document**: Keep this spec updated with actual implementation notes

**Ready to begin implementation!** =€
