# Teamwork Status Configuration Fix

## Problem

Tasks in Teamwork are showing in the "Backlog" lane in the UI, but the API returns their status as `"new"`. The monitor is configured to look for tasks with status `["new", "to do", "review"]`, so they **should** be picked up.

## Current Status

From the API, Task 26737953 returns:
```json
{
  "status": "new",
  "name": "Build Bun CLI: JSON Pretty Printer"
}
```

The monitor configuration in `adws/adw_modules/data_models.py:635`:
```python
status_filter: List[str] = Field(
    default_factory=lambda: ["new", "to do", "review"],
    description="Teamwork statuses to poll for (case-insensitive)"
)
```

## Solutions

### Option 1: Wait for API Credits to Restore ⏳

The tasks are already in the correct status (`"new"`). Once API credits restore, run:

```bash
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once
```

The monitor should pick them up automatically.

### Option 2: Manually Move Tasks in Teamwork UI 🖱️

If "Backlog" is a different status in your project:

1. Go to https://deliver.fellow.dk/app/projects/805682
2. Drag tasks from "Backlog" lane to a different lane (e.g., "Ready", "To Do", or whatever lane represents tasks ready to start)
3. The status will update and monitor will pick them up

### Option 3: Add Environment Variable Configuration 🔧

Add support for custom status filters via environment variable:

**In `.env`**:
```bash
# Comma-separated list of Teamwork statuses to monitor
TEAMWORK_STATUS_FILTER=backlog,new,to do,ready,review
```

**Update `adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py`**:

Around line 30-40, modify the status filter loading:

```python
# Get status filter from environment or use defaults
status_filter_env = os.getenv("TEAMWORK_STATUS_FILTER")
if status_filter_env:
    status_filter = [s.strip().lower() for s in status_filter_env.split(",")]
else:
    status_filter = ["new", "to do", "review"]  # defaults

config = TeamworkCronConfig(
    status_filter=status_filter,
    # ... other config
)
```

Then set in `.env`:
```bash
TEAMWORK_STATUS_FILTER=new,to do,review,backlog
```

### Option 4: Update Default Status Filter 📝

Permanently add "backlog" to the default status filter.

**Edit `adws/adw_modules/data_models.py` line 635**:

```python
status_filter: List[str] = Field(
    default_factory=lambda: ["new", "to do", "review", "backlog"],  # Added backlog
    description="Teamwork statuses to poll for (case-insensitive)"
)
```

Then restart the monitor:
```bash
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once
```

### Option 5: Use Teamwork Project Settings 🎯

Configure your Teamwork project to not use "Backlog" as the default status:

1. Go to Project Settings → Workflow/Board Configuration
2. Set default status for new tasks to "Ready" or "To Do" instead of "Backlog"
3. Move existing tasks to the new default status
4. Create future tasks with the correct status

## Recommended Approach

**Short-term**: Option 2 (manually move tasks in UI)
- Fastest solution
- No code changes needed
- Works immediately once API credits restore

**Long-term**: Option 3 or 4 (add "backlog" to status filter)
- Makes the system more flexible
- Supports different Teamwork configurations
- Option 3 (env var) is more configurable
- Option 4 (hardcode) is simpler

## Verification

After applying any solution, verify with:

```bash
# Test monitor
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --dry-run --once

# Should show:
# INFO - Found eligible task: 26737953
# INFO - Found eligible task: 26737954
# INFO - Found eligible task: 26737955
# INFO - Found eligible task: 26737956
```

## Why "new" vs "Backlog" Confusion?

Teamwork has:
- **Internal status codes** (e.g., `"new"`, `"in-progress"`) - used by the API
- **Display names** (e.g., "Backlog", "In Progress") - shown in the UI
- **Board lanes** - visual columns on the board view

Your project might be configured with:
- Internal status: `"new"`
- Display name: "Backlog"
- Board lane: "Backlog"

The API returns the internal status (`"new"`), which **is** in our filter. Once credits restore, it should work!

## Testing Without API Calls

You can verify the status mapping is correct:

```bash
# Check task status via MCP (no API usage)
# This uses your local .mcp.json config
```

Or check directly in Teamwork:
1. Open task: https://deliver.fellow.dk/app/tasks/26737953
2. Look at the status dropdown
3. If it says "New", "Backlog", or similar - it matches our filter

## Current Test Task Status

All 4 test tasks confirmed with API status = `"new"`:

| Task ID | Title | API Status | UI Lane | Will Be Picked Up? |
|---------|-------|------------|---------|-------------------|
| 26737953 | JSON Pretty Printer | `"new"` | Backlog | ✅ Yes (once credits restore) |
| 26737954 | GitHub Repo Stats | `"new"` | Backlog | ✅ Yes |
| 26737955 | File Hasher | `"new"` | Backlog | ✅ Yes |
| 26737956 | slugify utility | `"new"` | Backlog | ✅ Yes |

## Conclusion

**The tasks are already correctly configured!** The API returns `status: "new"` which is in the monitor's filter. The "Backlog" you see in the UI is just the display name/lane name.

**Next step**: Wait for API credits to reset, then run:
```bash
./adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py --once
```

The monitor will process all 4 tasks automatically.

---

**Alternative if you want to change Teamwork config**:
- Rename the board lane from "Backlog" to "Ready" (cosmetic only, doesn't affect status)
- Or add "backlog" to status_filter if your Teamwork has a separate "backlog" internal status code
