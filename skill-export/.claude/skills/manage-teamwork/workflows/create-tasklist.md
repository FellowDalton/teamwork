# Workflow: Create Tasklist

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
</required_reading>

<process>
## Step 1: Gather Required Information

**Required:**
- Project ID
- Tasklist name

**Optional:**
- Description
- Milestone ID (to associate with)

## Step 2: Get Project ID (if needed)

```typescript
import { createTeamworkClient } from '/Users/dalton/projects/teamwork/apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// List projects to find the right one
const projects = await client.projects.list({ status: 'active' });
for (const project of projects.projects) {
  console.log(`- [${project.id}] ${project.name}`);
}
```

## Step 3: Create Tasklist

The Teamwork API client doesn't have a dedicated tasklist creation method, so use the HTTP client directly:

```typescript
const response = await client.http.post(
  `/projects/api/v3/projects/${PROJECT_ID}/tasklists.json`,
  {
    tasklist: {
      name: 'Tasklist name',
      description: 'Optional description',
    }
  }
);

console.log('Created tasklist:', response);
```

## Step 4: List Existing Tasklists

To verify or see existing tasklists:

```typescript
const tasklists = await client.projects.getTasklists(PROJECT_ID);
console.log('Tasklists in project:');
for (const tl of tasklists.tasklists) {
  console.log(`- [${tl.id}] ${tl.name}`);
}
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Project ID identified
- [ ] Tasklist created with name
- [ ] Tasklist ID returned
- [ ] Visible in project tasklists
</success_criteria>
