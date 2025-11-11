# Deprecated Scripts

This directory contains scripts that are no longer needed after migrating to Bun/TypeScript.

## execute-claude-workflow.sh

**Status:** Deprecated
**Reason:** This was a workaround for Python subprocess rate limiting
**Replacement:** Bun's native `Bun.spawn()` works directly without any wrapper

The bash wrapper was created to avoid Python's subprocess.run() triggering Claude Code's rate limiter. With the migration to Bun/TypeScript, this wrapper is no longer needed because:

1. `Bun.spawn()` doesn't trigger the rate limiter
2. Direct execution is simpler and faster
3. No intermediary scripts required

**See:** `PYTHON_TO_BUN_MIGRATION_PLAN.md` for complete migration details

## bmad-start-workflow.sh

**Status:** Active - for BMAD workflows (different system)
**Reason:** This is for the BMAD multi-agent system, not ADWs
**Note:** This script is still in use for BMAD workflows
