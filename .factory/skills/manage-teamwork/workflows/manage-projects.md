# Workflow: Manage Projects

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
</required_reading>

<process>
## Step 1: List Projects

```typescript
import { createTeamworkClient } from './apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// List all active projects
const response = await client.projects.list({ status: 'active' });
console.log('Active projects:');
for (const project of response.projects) {
  console.log(`- [${project.id}] ${project.name}`);
}

// List with filters
const filtered = await client.projects.list({
  status: 'active',
  companyId: COMPANY_ID,  // filter by company
  searchTerm: 'search query',
  include: ['companies', 'users'],
  pageSize: 50,
});
```

## Step 2: Get Project Details

```typescript
const project = await client.projects.get(PROJECT_ID, ['companies', 'users']);
console.log('Project:', project.name);
console.log('Active workflow:', project.activeWorkflow);
```

## Step 3: Find Project by Name

```typescript
const project = await client.projects.findByName('Exact Project Name');
if (project) {
  console.log(`Found: ${project.id}`);
}
```

## Step 4: Get Project Tasklists

```typescript
const tasklists = await client.projects.getTasklists(PROJECT_ID);
console.log('Tasklists:');
for (const tl of tasklists.tasklists) {
  console.log(`- [${tl.id}] ${tl.name}`);
}
```

## Step 5: Get Project Workflow

```typescript
const workflow = await client.projects.getActiveWorkflow(PROJECT_ID);
if (workflow) {
  console.log(`Workflow: ${workflow.id} - ${workflow.name}`);

  // Get stages
  const stages = await client.workflows.getStages(workflow.id);
  for (const stage of stages) {
    console.log(`  Stage: ${stage.id} - ${stage.name}`);
  }
}
```

## Step 6: Create Project (via MCP or Direct API)

The TypeScript client focuses on task management. For project creation, use the Teamwork MCP server:

```typescript
// Via MCP tool (if available)
mcp__teamwork__twprojects-create_project({
  name: 'New Project Name',
  description: 'Project description',
  start_at: '20241201',  // YYYYMMDD
  end_at: '20241231',
  company_id: COMPANY_ID,
});
```

Or via direct API:

```typescript
const response = await client.http.post('/projects/api/v3/projects.json', {
  project: {
    name: 'New Project Name',
    description: 'Project description',
    companyId: COMPANY_ID,
    // startDate, endDate, etc.
  }
});
console.log('Created project:', response);
```

## Step 7: Apply Workflow to Project

```typescript
// Apply a workflow (board) to a project
await client.projects.applyWorkflow(PROJECT_ID, WORKFLOW_ID);

// Remove workflow
await client.projects.removeWorkflow(PROJECT_ID, WORKFLOW_ID);
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Project operation type identified (list, get, create)
- [ ] Operation executed successfully
- [ ] Results displayed or confirmed
</success_criteria>
