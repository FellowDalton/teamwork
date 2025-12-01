# Plan: Teamwork API Client

## Metadata
adw_id: `manual-planning`
prompt: `Build a direct Teamwork API client to replace MCP-based task workflows, including workflow/stage support not available in MCP`
app_name: `teamwork_api_client`
task_type: automation
complexity: complex

## Task Description
Create a comprehensive Bun TypeScript client library for the Teamwork.com API v3 that directly interacts with the REST API. This replaces the current approach of using MCP tools through slash commands, providing:
- Direct HTTP requests to Teamwork API
- Full workflow and stage management (not available in MCP)
- Task lifecycle management with board/column support
- Integration with the existing ADW trigger system

## Objective
When complete, this client will:
1. Provide a type-safe TypeScript API for all Teamwork operations
2. Support workflow stages for proper task board management
3. Enable direct task status updates without MCP intermediary
4. Integrate seamlessly with existing `adw-trigger-cron-teamwork-tasks.ts`
5. Eliminate dependency on the external MCP Go server

## Problem Statement
The current implementation relies on an MCP server (`teamwork-mcp`) that:
- Does **not** expose workflow endpoints (no stage/column management)
- Requires running a separate Go process
- Creates coupling between the agent system and MCP protocol
- Status filtering happens client-side after fetching all tasks

Direct API access provides:
- Full workflow/stage support for board-based task management
- Server-side filtering with proper query parameters
- No external process dependencies
- Better error handling and retry logic

## Solution Approach
Build a modular TypeScript client with:
1. **Core HTTP client** - Authentication, retry logic, rate limiting
2. **Resource modules** - Tasks, Projects, Workflows, Stages, Comments
3. **Type definitions** - Zod schemas matching API responses
4. **Integration layer** - Drop-in replacement for MCP-based functions

## Relevant Files

### Existing Files to Reference
- `adws-bun/src/modules/data-models.ts` - Existing TeamworkTask schema and types
- `adws-bun/src/triggers/adw-trigger-cron-teamwork-tasks.ts` - Current trigger using MCP
- `.mcp.json` - Contains API URL and bearer token configuration
- `.claude/commands/get_teamwork_tasks.md` - Current task fetching logic
- `.claude/commands/update_teamwork_task.md` - Current update logic

### New Files to Create
- `apps/teamwork_api_client/src/client.ts` - Core HTTP client with auth
- `apps/teamwork_api_client/src/types.ts` - Zod schemas for API responses
- `apps/teamwork_api_client/src/resources/tasks.ts` - Task operations
- `apps/teamwork_api_client/src/resources/projects.ts` - Project operations
- `apps/teamwork_api_client/src/resources/workflows.ts` - Workflow & stage operations
- `apps/teamwork_api_client/src/resources/comments.ts` - Comment operations
- `apps/teamwork_api_client/src/index.ts` - Main export module
- `apps/teamwork_api_client/tests/` - Test suite

## Implementation Phases

### Phase 1: Foundation
- Set up Bun project structure with TypeScript
- Create core HTTP client with authentication
- Define base Zod schemas for API responses
- Implement error handling and retry logic

### Phase 2: Core Implementation
- Build task resource module (CRUD + filtering)
- Build workflow resource module (stages, backlog, task positions)
- Build project resource module (workflow assignment)
- Build comment resource module (for status updates)

### Phase 3: Integration & Polish
- Create high-level facade matching current MCP usage patterns
- Add integration tests with live API
- Update trigger script to use new client (optional migration path)
- Document API coverage and usage examples

## Step by Step Tasks

### 1. Initialize Bun Project
- Create `apps/teamwork_api_client/` directory
- Run `bun init` to set up TypeScript configuration
- Add dependencies: `zod` for validation
- Configure `tsconfig.json` with strict mode
- Create directory structure: `src/`, `src/resources/`, `tests/`

### 2. Create Core HTTP Client
- Read API URL and token from environment variables
- Implement `TeamworkClient` class with:
  - `get<T>(path, params)` - GET requests with query params
  - `post<T>(path, body)` - POST requests with JSON body
  - `patch<T>(path, body)` - PATCH requests for updates
  - `delete(path)` - DELETE requests
- Add Bearer token authentication header
- Implement exponential backoff retry (3 attempts)
- Handle rate limiting (429 responses)
- Add request/response logging in debug mode

### 3. Define Base Type Schemas
- Create `types.ts` with Zod schemas:
  - `ApiResponseSchema` - Wrapper for paginated responses
  - `TaskSchema` - Full task object with all fields
  - `ProjectSchema` - Project with workflow info
  - `WorkflowSchema` - Workflow definition
  - `StageSchema` - Workflow stage/column
  - `CommentSchema` - Task comments
  - `UserSchema` - User reference
  - `TagSchema` - Task tags
- Export TypeScript types via `z.infer<>`

### 4. Build Tasks Resource Module
- `listTasks(projectId, options)` - GET /projects/api/v3/projects/{id}/tasks.json
  - Support status filtering via `taskStatuses` param
  - Support tag filtering
  - Handle pagination with cursor
- `getTask(taskId)` - GET /projects/api/v3/tasks/{id}.json
  - Include tags, assignees, custom fields
- `createTask(tasklistId, task)` - POST /projects/api/v3/tasklists/{id}/tasks.json
- `updateTask(taskId, updates)` - PATCH /projects/api/v3/tasks/{id}.json
  - Update status, description, assignees
- `deleteTask(taskId)` - DELETE /projects/api/v3/tasks/{id}.json

### 5. Build Workflows Resource Module
- `listWorkflows(options)` - GET /projects/api/v3/workflows.json
  - Filter by project, include stages
- `getWorkflow(workflowId)` - GET /projects/api/v3/workflows/{id}.json
- `getWorkflowStages(workflowId)` - GET /projects/api/v3/workflows/{id}/stages.json
- `getStage(workflowId, stageId)` - GET /projects/api/v3/workflows/{id}/stages/{stageId}.json
- `getStageTasks(workflowId, stageId)` - GET /projects/api/v3/workflows/{id}/stages/{stageId}/tasks
- `getBacklogTasks(workflowId)` - GET /projects/api/v3/workflows/{id}/backlog
- `addTaskToStage(workflowId, stageId, taskId)` - POST /projects/api/v3/workflows/{id}/stages/{stageId}/tasks.json
- `updateTaskPosition(taskId, workflowId, stageId, position)` - PATCH /projects/api/v3/tasks/{taskId}/workflows/{workflowId}.json
  - Move task between stages/columns

### 6. Build Projects Resource Module
- `listProjects(options)` - GET /projects/api/v3/projects.json
- `getProject(projectId)` - GET /projects/api/v3/projects/{id}.json
  - Include workflow information
- `getProjectWorkflow(projectId)` - Get active workflow for project
- `applyWorkflow(projectId, workflowId)` - POST /projects/api/v3/projects/{id}/workflows.json

### 7. Build Comments Resource Module
- `listTaskComments(taskId)` - GET /projects/api/v3/tasks/{id}/comments.json
- `createComment(taskId, body)` - POST /projects/api/v3/tasks/{id}/comments.json
  - Used for posting status updates and agent output
- Format comment with ADW metadata (adw_id, timestamp, commit_hash)

### 8. Create High-Level Facade
- `TeamworkTaskMonitor` class matching current usage:
  - `getEligibleTasks(projectId, statusFilter, limit)` - Replaces `/get_teamwork_tasks`
  - `updateTaskStatus(taskId, status, metadata)` - Replaces `/update_teamwork_task`
  - `claimTask(taskId, adwId)` - Update status + post claim comment
  - `completeTask(taskId, result)` - Update status + post result comment
  - `failTask(taskId, error)` - Update status + post error comment
- Parse task descriptions for execution triggers
- Extract tags (native + inline `{{key: value}}`)
- Build clean task prompts

### 9. Create Main Export Module
- Export all resource modules
- Export facade class
- Export types and schemas
- Provide factory function: `createTeamworkClient(config)`

### 10. Write Unit Tests
- Test HTTP client retry logic
- Test Zod schema validation
- Test tag extraction from descriptions
- Test execution trigger parsing
- Mock API responses with Bun test utilities

### 11. Write Integration Tests
- Test against live API (requires credentials)
- Verify workflow stage listing
- Verify task status updates
- Verify comment posting
- Use `bun test` with `--preload` for env setup

### 12. Create CLI Tool for Testing
- `src/cli.ts` - Command-line interface for manual testing
- Commands:
  - `list-tasks <project_id>` - List tasks with status
  - `list-workflows` - Show available workflows
  - `list-stages <workflow_id>` - Show workflow stages
  - `move-task <task_id> <stage_id>` - Move task to stage
  - `update-status <task_id> <status>` - Update task status

### 13. Validate Against Existing Workflow
- Ensure output format matches `TeamworkTaskSchema` in data-models.ts
- Verify `getEligibleTasks` returns same structure as current `/get_teamwork_tasks`
- Test integration with `adw-trigger-cron-teamwork-tasks.ts`

## Testing Strategy

### Unit Tests
- HTTP client error handling and retry logic
- Zod schema validation for all API response types
- Tag extraction regex patterns
- Execution trigger detection logic
- Comment formatting

### Integration Tests
- Live API authentication
- Task CRUD operations
- Workflow and stage listing
- Task position updates within workflows
- Rate limiting behavior

### End-to-End Tests
- Full task lifecycle: fetch → claim → process → complete
- Workflow stage transitions
- Error recovery scenarios

## Acceptance Criteria

1. **Authentication**: Client authenticates with Bearer token from environment
2. **Task Operations**: Can list, get, create, update, delete tasks
3. **Workflow Support**: Can list workflows, stages, and move tasks between stages
4. **Status Updates**: Can update task status and post formatted comments
5. **Tag Parsing**: Extracts both native tags and inline `{{key: value}}` tags
6. **Type Safety**: All API responses validated with Zod schemas
7. **Error Handling**: Retries transient failures, surfaces API errors clearly
8. **Compatibility**: Output matches existing `TeamworkTask` interface
9. **Test Coverage**: >80% code coverage with unit tests
10. **Documentation**: README with usage examples and API coverage

## Validation Commands

Execute these commands to validate the task is complete:

- `cd apps/teamwork_api_client && bun install` - Install dependencies
- `cd apps/teamwork_api_client && bun run build` - Compile TypeScript (if applicable)
- `cd apps/teamwork_api_client && bun test` - Run test suite
- `cd apps/teamwork_api_client && bun run src/cli.ts list-workflows` - Test CLI
- `cd apps/teamwork_api_client && bun run src/cli.ts list-tasks <PROJECT_ID>` - Test task listing

## Notes

### Environment Variables Required
```bash
TEAMWORK_API_URL=https://deliver.fellow.dk  # From .mcp.json
TEAMWORK_BEARER_TOKEN=tkn.v1_...            # From .mcp.json
TEAMWORK_PROJECT_ID=366085                   # Default project
```

### API Rate Limits
Teamwork API has rate limits. The client should:
- Respect `X-RateLimit-*` headers
- Implement exponential backoff on 429 responses
- Queue requests during rate limit windows

### Workflow Stages vs Status
Important distinction:
- **Status**: Task completion state (new, in progress, complete)
- **Stage**: Board column position within workflow (Backlog, To Do, In Progress, Review)

Both can be updated independently. Moving a task to a different stage doesn't automatically change its status.

### Migration Path
This client can run alongside the existing MCP approach:
1. Deploy client as standalone module
2. Add to `adws-bun/src/modules/` as new module
3. Update trigger to use new client (feature flag)
4. Remove MCP dependency after validation

### Dependencies
- `zod` - Runtime type validation
- No external HTTP library needed (Bun has native `fetch`)

### API Documentation Sources
- https://apidocs.teamwork.com/docs/teamwork
- https://developer.teamwork.com/projects/api-v3
- https://apidocs.teamwork.com/docs/teamwork/endpoints-by-object/workflows
