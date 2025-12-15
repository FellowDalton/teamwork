# Workflow: Get Project Budget

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
</required_reading>

<process>
## Step 1: Get Budget for a Project

```typescript
import { createTeamworkClient } from './apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// Get all budgets for a project
const PROJECT_ID = 123456; // Replace with actual project ID
const response = await client.budgets.listByProject(PROJECT_ID);

console.log('Project Budgets:');
for (const budget of response.budgets) {
  console.log(`- Budget ID: ${budget.id}`);
  console.log(`  Type: ${budget.type}`);
  console.log(`  Status: ${budget.status}`);
  console.log(`  Capacity: ${budget.capacity}`);
  console.log(`  Used: ${budget.capacityUsed}`);
  if (budget.capacity) {
    const percent = ((budget.capacityUsed ?? 0) / budget.capacity * 100).toFixed(1);
    console.log(`  Utilization: ${percent}%`);
  }
  console.log(`  Currency: ${budget.currencyCode ?? 'N/A'}`);
  console.log(`  Period: ${budget.startDateTime} to ${budget.endDateTime}`);
  console.log('');
}
```

## Step 2: Get Active Budget (Most Recent)

```typescript
// Get the most recent active budget for a project
const activeBudget = await client.budgets.getActiveByProject(PROJECT_ID);

if (activeBudget) {
  console.log('Active Budget:', activeBudget.id);
  console.log('Capacity:', activeBudget.capacity);
  console.log('Used:', activeBudget.capacityUsed);
} else {
  console.log('No active budget found for this project');
}
```

## Step 3: Get Budget Utilization

```typescript
// Get budget utilization as a percentage
const utilization = await client.budgets.getUtilization(PROJECT_ID);

if (utilization) {
  console.log(`Budget: ${utilization.budget.id}`);
  console.log(`Capacity: ${utilization.budget.capacity}`);
  console.log(`Used: ${utilization.budget.capacityUsed}`);
  console.log(`Utilization: ${utilization.utilizationPercent.toFixed(1)}%`);
  
  // Check if over budget
  if (utilization.utilizationPercent > 100) {
    console.log('WARNING: Project is over budget!');
  } else if (utilization.utilizationPercent > 80) {
    console.log('CAUTION: Budget is nearly exhausted');
  }
} else {
  console.log('No budget configured for this project');
}
```

## Step 4: Get Tasklist Budgets

```typescript
// Get tasklist-level budget breakdown for a project budget
const BUDGET_ID = 789; // Replace with actual budget ID
const tasklistBudgets = await client.budgets.getTasklistBudgets(BUDGET_ID, {
  include: ['tasklists', 'projectBudgets'],
});

console.log('Tasklist Budgets:');
for (const tlBudget of tasklistBudgets.budgets) {
  console.log(`- Tasklist Budget ID: ${tlBudget.id}`);
  console.log(`  Tasklist ID: ${tlBudget.tasklistId}`);
  console.log(`  Capacity: ${tlBudget.capacity}`);
  console.log(`  Used: ${tlBudget.capacityUsed}`);
  console.log('');
}
```

## Step 5: Get Specific Budget by ID

```typescript
// Get a specific budget by its ID
const budget = await client.budgets.get(BUDGET_ID);
console.log('Budget Details:', budget);
```

## Step 6: List Budgets with Pagination

```typescript
// Get budgets with pagination options
const paginatedBudgets = await client.budgets.listByProject(PROJECT_ID, {
  orderBy: 'dateCreated',
  orderMode: 'desc',
  page: 1,
  pageSize: 10,
});

console.log(`Found ${paginatedBudgets.budgets.length} budgets`);
if (paginatedBudgets.meta?.page?.hasMore) {
  console.log('More budgets available on next page');
}
```
</process>

<api_reference>
## Budget Types

**Budget Type** (budget.type):
- `time` - Time-based budget (hours/minutes)
- `financial` - Financial budget (currency-based)

**Budget Status** (budget.status):
- `active` - Budget is currently active
- `completed` - Budget period has ended

## Key Fields

| Field | Description |
|-------|-------------|
| `capacity` | Total budget capacity |
| `capacityUsed` | Amount of budget consumed |
| `currencyCode` | Currency for financial budgets (e.g., USD, EUR) |
| `timelogType` | Type of time tracking (for time budgets) |
| `startDateTime` | Budget period start date |
| `endDateTime` | Budget period end date |
| `isRepeating` | Whether budget repeats automatically |
| `repeatPeriod` | Number of repeat units |
| `repeatUnit` | Unit of repetition (week, month, etc.) |

## API Endpoints Used

- `GET /projects/api/v3/projects/{projectId}/budgets.json` - List project budgets
- `GET /projects/api/v3/projects/budgets/{budgetId}.json` - Get specific budget
- `GET /projects/api/v3/projects/budgets/{budgetId}/tasklists/budgets.json` - Get tasklist budgets
</api_reference>

<success_criteria>
This workflow is complete when:
- [ ] Budget operation type identified (list, get active, utilization, tasklist)
- [ ] Correct project or budget ID obtained
- [ ] Operation executed successfully
- [ ] Budget information displayed with utilization metrics
</success_criteria>
