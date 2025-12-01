# Workflow: Log Time on Task

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
</required_reading>

<process>
## Step 1: Gather Information

**Required:**
- Task ID (or Project ID for project-level time)
- Hours and/or minutes
- Date (YYYY-MM-DD format)

**Optional:**
- Description of work done
- Billable flag
- User ID (defaults to authenticated user)

## Step 2: Log Time via Direct API

The Teamwork API client doesn't have a dedicated timelog resource, so use the HTTP client:

```typescript
import { createTeamworkClient } from './apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

const response = await client.http.post(
  `/projects/api/v3/tasks/${TASK_ID}/time.json`,
  {
    timelog: {
      description: 'Work description here',
      date: '2024-12-01',  // YYYY-MM-DD
      hours: 2,
      minutes: 30,
      isBillable: true,
      // userId: USER_ID,  // optional, defaults to authenticated user
    }
  }
);

console.log('Time logged:', response);
```

## Step 3: Log Time at Project Level

If logging time without a specific task:

```typescript
const response = await client.http.post(
  `/projects/api/v3/projects/${PROJECT_ID}/time.json`,
  {
    timelog: {
      description: 'General project work',
      date: '2024-12-01',
      hours: 1,
      minutes: 0,
      isBillable: false,
    }
  }
);
```

## Step 4: View Time Entries

```typescript
// Get time entries for a task
const response = await client.http.get(
  `/projects/api/v3/tasks/${TASK_ID}/time.json`
);
console.log('Time entries:', response);

// Get time entries for a project
const projectTime = await client.http.get(
  `/projects/api/v3/projects/${PROJECT_ID}/time.json`
);
```

## Step 5: Using the Teamwork MCP Server

If the Teamwork MCP server is available, you can also use:

```typescript
// Via MCP tool (if available)
mcp__teamwork__twprojects-create_timelog({
  task_id: TASK_ID,
  date: '2024-12-01',
  time: '09:00:00',
  hours: 2,
  minutes: 30,
  description: 'Work description',
  billable: true,
});
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Task or project ID identified
- [ ] Time entry details gathered (hours, minutes, date)
- [ ] Time logged via API
- [ ] Confirmation received
</success_criteria>
