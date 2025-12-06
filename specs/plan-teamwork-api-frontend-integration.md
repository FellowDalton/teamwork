# Plan: Teamwork API Client + Frontend Integration

## Metadata
adw_id: `teamwork-api-frontend-integration`
prompt: `we need to create a plan for implementing @apps/teamwork_api_client/ with the @apps/teamwork_frontend/ I need you to look through and understand the frontend app and see what needs to be implemented. If any API endpoint is missing I need you to create it and test it. The @.env holds ANTHROPIC_API_KEY, E2B_API_KEY, TEAMWORK_PROJECT_ID, TEAMWORK_API_URL, TEAMWORK_BEARER_TOKEN`
task_type: feature
complexity: complex

## Task Description
Integrate the `teamwork_api_client` TypeScript API client with the `teamwork_frontend` React application. The frontend currently uses mock data and direct Claude API calls. We need to:
1. Add missing API resources (Time Entries) to the API client
2. Create a backend service layer to proxy API calls
3. Replace frontend mock data with real Teamwork API data
4. Connect frontend tool functions to real Teamwork operations

## Objective
A fully integrated Teamwork workflow application where:
- Frontend displays real data from Teamwork.com API
- Time logging operations persist to Teamwork
- Project/task operations use real API calls
- Claude AI assistant can interact with live Teamwork data

## Problem Statement
The frontend (`teamwork_frontend`) is a React application with a conversation-based UI that:
- Uses hardcoded mock data (`INITIAL_PROJECTS`)
- Calls Claude API directly from the browser (security concern with exposed API key)
- Has tool functions (`logWork`, `createProject`, `displayTasks`, etc.) that only modify local state
- Cannot connect to the real Teamwork API

The API client (`teamwork_api_client`) is a comprehensive TypeScript client with:
- Full CRUD for Tasks, Projects, Workflows, Stages
- Comment posting with ADW status updates
- Tag parsing and execution trigger detection
- **Missing: Time Entry/Timelog resource**

## Solution Approach
1. **Add TimeEntryResource** to the API client for time tracking operations
2. **Create a Backend Service** using Bun.serve() that:
   - Proxies Teamwork API calls (keeps tokens server-side)
   - Proxies Claude API calls (keeps ANTHROPIC_API_KEY server-side)
   - Serves the frontend
3. **Update Frontend** to call backend endpoints instead of:
   - Mock data for projects/tasks
   - Direct Claude API calls
4. **Connect Tool Functions** to real API operations

## Relevant Files

### Existing Files to Modify

- `apps/teamwork_api_client/src/index.ts` - Export new TimeEntryResource
- `apps/teamwork_api_client/src/types.ts` - Add TimeEntry Zod schemas
- `apps/teamwork_frontend/services/claudeService.ts` - Update to call backend instead of direct Claude API
- `apps/teamwork_frontend/App.tsx` - Replace mock data with API calls, update tool handlers
- `apps/teamwork_frontend/types.ts` - Extend types to match API responses
- `apps/teamwork_frontend/vite.config.ts` - Add proxy for backend during dev

### New Files to Create

- `apps/teamwork_api_client/src/resources/time-entries.ts` - Time tracking resource
- `apps/teamwork_api_client/tests/time-entries.test.ts` - Unit tests for time entry operations
- `apps/teamwork_frontend/server.ts` - Bun backend server with routes
- `apps/teamwork_frontend/services/teamworkService.ts` - Frontend service to call backend API
- `apps/teamwork_frontend/hooks/useTeamworkData.ts` - React hooks for data fetching

## Implementation Phases

### Phase 1: Foundation - Add Missing API Client Resource
Add the TimeEntryResource to `teamwork_api_client` for time tracking operations:
- List time entries (by project, task, or global)
- Create time entries
- Update time entries
- Delete time entries

### Phase 2: Core Implementation - Backend Service
Create a Bun.serve() backend that:
- Imports and uses `teamwork_api_client`
- Exposes REST endpoints for frontend consumption
- Proxies Claude API calls securely
- Loads env vars server-side (ANTHROPIC_API_KEY, TEAMWORK_* vars)

### Phase 3: Integration & Polish - Frontend Connection
Update frontend to:
- Fetch real data on mount
- Send tool operations to backend
- Handle loading/error states
- Maintain UI responsiveness

## Step by Step Tasks

### 1. Add TimeEntry Types to API Client
- Create Zod schemas for TimeEntry in `apps/teamwork_api_client/src/types.ts`:
  - `TimeEntrySchema` - id, taskId, projectId, minutes, hours, description, date, isBillable, userId
  - `TimeEntryListResponseSchema`
  - `TimeEntryResponseSchema`
  - `CreateTimeEntryRequestSchema`
  - `UpdateTimeEntryRequestSchema`
- Export types from index.ts

### 2. Create TimeEntryResource
- Create `apps/teamwork_api_client/src/resources/time-entries.ts`:
  - `list(options)` - GET /projects/api/v3/time.json
  - `listByProject(projectId, options)` - GET /projects/api/v3/projects/{projectId}/time.json
  - `listByTask(taskId, options)` - GET /projects/api/v3/tasks/{taskId}/time.json
  - `get(timeEntryId)` - GET /projects/api/v3/time/{id}.json
  - `create(projectId, options)` - POST /projects/api/v3/projects/{projectId}/time.json
  - `createForTask(taskId, options)` - POST /projects/api/v3/tasks/{taskId}/time.json
  - `update(timeEntryId, options)` - PATCH /projects/api/v3/time/{id}.json
  - `delete(timeEntryId)` - DELETE /projects/api/v3/time/{id}.json
- Register in `createTeamworkClient()` and `TeamworkTaskMonitor`

### 3. Write Tests for TimeEntryResource
- Create `apps/teamwork_api_client/tests/time-entries.test.ts`:
  - Test list/filter operations
  - Test create time entry
  - Test update time entry
  - Test delete time entry
  - Test options parsing
- Run `bun test` to verify

### 4. Create Backend Server
- Create `apps/teamwork_frontend/server.ts` with Bun.serve():
  ```typescript
  // Routes:
  // GET /api/projects - List projects
  // GET /api/projects/:id - Get project with tasks/stages
  // GET /api/projects/:id/tasks - List tasks for project
  // POST /api/tasks/:id/time - Log time to task
  // GET /api/time-entries - List time entries
  // POST /api/chat - Proxy Claude API call
  // Static: /* - Serve frontend
  ```
- Import and use `teamwork_api_client`
- Load .env with Teamwork and Anthropic credentials
- Add CORS headers for dev

### 5. Create Frontend Teamwork Service
- Create `apps/teamwork_frontend/services/teamworkService.ts`:
  - `fetchProjects()` - Get all projects with stages/tasks
  - `fetchProjectTasks(projectId)` - Get tasks for a project
  - `logTimeEntry(taskId, hours, description, isBillable)` - Log time
  - `createProject(data)` - Create new project (if supported by Teamwork API)
  - `fetchTimeEntries(projectId)` - Get logged time
- Handle API errors gracefully

### 6. Create Data Fetching Hooks
- Create `apps/teamwork_frontend/hooks/useTeamworkData.ts`:
  - `useProjects()` - Fetch and cache projects
  - `useProjectTasks(projectId)` - Fetch tasks for project
  - `useTimeEntries(projectId)` - Fetch time entries
- Use React state for loading/error handling

### 7. Update claudeService to Use Backend
- Modify `apps/teamwork_frontend/services/claudeService.ts`:
  - Change direct Claude API call to `POST /api/chat`
  - Remove ANTHROPIC_API_KEY from frontend define
  - Update response handling

### 8. Update App.tsx with Real Data
- Replace `INITIAL_PROJECTS` mock data with API fetch:
  - Fetch projects on mount using `useProjects()`
  - Transform Teamwork API response to match frontend types
- Update tool handlers:
  - `handleLogWork()` - Call `teamworkService.logTimeEntry()`
  - `handleDisplayTasks()` - Use real task data
  - `handleDisplayTimelogs()` - Use real time entry data
  - `handleDisplayStatus()` - Calculate from real data

### 9. Update Vite Config for Development
- Add proxy in `apps/teamwork_frontend/vite.config.ts`:
  ```typescript
  proxy: {
    '/api': 'http://localhost:3051'
  }
  ```
- Update scripts in package.json for dev workflow

### 10. Integration Testing
- Start backend server: `bun run apps/teamwork_frontend/server.ts`
- Start frontend dev: `cd apps/teamwork_frontend && bun run dev`
- Test scenarios:
  - Projects load from Teamwork
  - Tasks display correctly
  - Time logging persists to Teamwork
  - Claude chat works through backend proxy

## Testing Strategy

### Unit Tests (API Client)
- TimeEntryResource CRUD operations
- Option parsing for list queries
- Error handling for API failures

### Integration Tests
- Backend routes return correct data shapes
- Claude proxy forwards requests correctly
- Time entry creation reflects in Teamwork

### Manual E2E Tests
- Select project → tasks display
- Log time via chat → appears in Teamwork
- Ask Claude about status → shows real metrics
- Create project (if API supports)

## Acceptance Criteria
- [ ] TimeEntryResource exists with full CRUD + tests passing
- [ ] Backend server runs and proxies Teamwork + Claude API
- [ ] Frontend loads real projects from Teamwork
- [ ] Time logging from chat persists to Teamwork API
- [ ] Claude AI responses work through backend proxy
- [ ] No API keys exposed in frontend code
- [ ] `bun test` passes in teamwork_api_client
- [ ] TypeScript compiles without errors in both apps

## Validation Commands

Execute these commands to validate the task is complete:

- `cd apps/teamwork_api_client && bun test` - Run API client tests (should include time-entries.test.ts)
- `cd apps/teamwork_api_client && bun run typecheck` - TypeScript compilation check
- `cd apps/teamwork_frontend && bun run build` - Frontend builds successfully
- `bun run apps/teamwork_frontend/server.ts` - Backend server starts without error
- `curl http://localhost:3051/api/projects` - Projects endpoint returns Teamwork data

## Notes

### Environment Variables Required
All from root `.env`:
- `ANTHROPIC_API_KEY` - For Claude API proxy
- `TEAMWORK_API_URL` - e.g., https://deliver.fellow.dk
- `TEAMWORK_BEARER_TOKEN` - Teamwork API auth
- `TEAMWORK_PROJECT_ID` - Default project ID

### Teamwork API Time Tracking Endpoints
Based on Teamwork.com API v3 documentation:
- `GET /projects/api/v3/time.json` - All time entries
- `GET /projects/api/v3/projects/{projectId}/time.json` - Project time entries
- `GET /projects/api/v3/tasks/{taskId}/time.json` - Task time entries
- `POST /projects/api/v3/projects/{projectId}/time.json` - Create time entry
- `PATCH /projects/api/v3/time/{id}.json` - Update time entry
- `DELETE /projects/api/v3/time/{id}.json` - Delete time entry

### Frontend Type Mapping
The frontend uses simplified types (`Task`, `Stage`, `Project`) that need mapping from API types (`ApiTask`, `Stage`, `Project`). The backend should transform API responses to match frontend expectations.

### Rate Limiting Considerations
The `teamwork_api_client` already has retry logic with exponential backoff. The backend should pass through rate limit errors appropriately to the frontend.
