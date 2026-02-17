# Get Activity Status

Report on user work activity for a time period. Supports natural language time periods and optional visual card display via the frontend.

## Step 1: Gather Parameters

Ask the user (if not already specified):

**Date Range - Natural Language Support:**
- "today" / "yesterday"
- "this week" / "last week"
- "this month" / "last month"
- "this year" / "last year"
- "all time"
- **Dynamic:** "last N days/weeks/months/years" (e.g., "last 7 months", "past 2 weeks")
- Custom: specific start and end dates (YYYY-MM-DD)

**User:**
- Default to current authenticated user
- Can specify another user by ID if admin

**Project Filter (optional):**
- Filter to a specific project by ID

## Step 2: Parse Dynamic Time Periods

```typescript
interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

function getDateRange(input: string): DateRange {
  const today = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];
  const lowerInput = input.toLowerCase();
  
  // Dynamic parsing: "last N days/weeks/months/years"
  const dynamicMatch = lowerInput.match(/(?:last|past)\s+(\d+)\s+(days?|weeks?|months?|years?)/i);
  if (dynamicMatch) {
    const amount = parseInt(dynamicMatch[1]);
    const unit = dynamicMatch[2].toLowerCase();
    let days: number;
    
    if (unit.startsWith('day')) days = amount;
    else if (unit.startsWith('week')) days = amount * 7;
    else if (unit.startsWith('month')) days = amount * 30;
    else if (unit.startsWith('year')) days = amount * 365;
    else days = 1;
    
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - days);
    
    return {
      startDate: format(pastDate),
      endDate: format(today),
      label: `Last ${amount} ${unit}`,
    };
  }
  
  // Static period parsing
  switch (lowerInput) {
    case 'today':
      return { startDate: format(today), endDate: format(today), label: 'Today' };
    
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: format(yesterday), endDate: format(yesterday), label: 'Yesterday' };
    }
    
    case 'this week':
    case 'thisweek': {
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      return { startDate: format(monday), endDate: format(today), label: 'This Week' };
    }
    
    case 'last week':
    case 'lastweek': {
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - today.getDay() - 6);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { startDate: format(lastMonday), endDate: format(lastSunday), label: 'Last Week' };
    }
    
    case 'this month':
    case 'thismonth': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: format(firstOfMonth), endDate: format(today), label: 'This Month' };
    }
    
    case 'last month':
    case 'lastmonth': {
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: format(firstOfLastMonth), endDate: format(lastOfLastMonth), label: 'Last Month' };
    }
    
    case 'this year':
    case 'thisyear': {
      const firstOfYear = new Date(today.getFullYear(), 0, 1);
      return { startDate: format(firstOfYear), endDate: format(today), label: 'This Year' };
    }
    
    case 'all time':
    case 'alltime': {
      const fiveYearsAgo = new Date(today);
      fiveYearsAgo.setFullYear(today.getFullYear() - 5);
      return { startDate: format(fiveYearsAgo), endDate: format(today), label: 'All Time' };
    }
    
    default:
      throw new Error(`Unknown period: ${input}. Try "last 7 months" or "this week".`);
  }
}
```

## Step 3: Fetch Data

```typescript
import { createTeamworkClient } from '/Users/dalton/projects/teamwork/apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// 1. Get current user
const currentUser = await client.people.me();
const userId = currentUser.id;
const userName = `${currentUser.firstName} ${currentUser.lastName}`;

// 2. Calculate date range
const { startDate, endDate } = getDateRange('this week'); // or user input

// 3. Get time entries for the period
const timeResponse = await client.timeEntries.list({
  startDate,
  endDate,
  include: ['tasks', 'projects'],
  orderBy: 'date',
  orderMode: 'desc',
  pageSize: 500,
});

// Filter to only this user's entries (API may return all visible entries)
const myTimeEntries = timeResponse.timelogs.filter(
  t => t.userId === userId
);

// 4. Get activity feed for the period
const activityResponse = await client.activity.getUserActivityForPeriod(
  userId,
  startDate,
  endDate,
  { 
    activityTypes: ['task', 'task_comment'],
    include: ['projects', 'users'],
  }
);
```

## Step 4: Generate Summary

```typescript
// Calculate totals
const totalMinutes = myTimeEntries.reduce((sum, e) => sum + e.minutes, 0);
const totalHours = (totalMinutes / 60).toFixed(1);

// Group time by project
const timeByProject = new Map<number, { name: string; minutes: number }>();
for (const entry of myTimeEntries) {
  const projectId = entry.projectId;
  const existing = timeByProject.get(projectId) || { name: `Project ${projectId}`, minutes: 0 };
  existing.minutes += entry.minutes;
  timeByProject.set(projectId, existing);
}

// Get unique tasks worked on
const tasksWorkedOn = new Set(myTimeEntries.map(e => e.taskId).filter(Boolean));

// Format output
console.log(`\n## Activity Report for ${userName}`);
console.log(`**Period:** ${startDate} to ${endDate}\n`);

console.log(`### Time Logged`);
console.log(`- **Total:** ${totalHours} hours (${totalMinutes} minutes)`);
console.log(`- **Tasks worked on:** ${tasksWorkedOn.size}`);
console.log(`- **Time entries:** ${myTimeEntries.length}\n`);

if (timeByProject.size > 0) {
  console.log(`### By Project`);
  for (const [id, data] of timeByProject) {
    console.log(`- ${data.name}: ${(data.minutes / 60).toFixed(1)} hours`);
  }
}

if (activityResponse.length > 0) {
  console.log(`\n### Recent Activity`);
  for (const activity of activityResponse.slice(0, 10)) {
    const date = new Date(activity.dateTime).toLocaleDateString();
    console.log(`- [${date}] ${activity.activityType}: ${activity.description || activity.itemDescription}`);
  }
}
```

## Example Output

```
## Activity Report for John Doe
**Period:** 2024-12-02 to 2024-12-04

### Time Logged
- **Total:** 14.5 hours (870 minutes)
- **Tasks worked on:** 5
- **Time entries:** 8

### By Project
- AI Workflow Test: 10.0 hours
- Internal Tools: 4.5 hours

### Recent Activity
- [12/4] task: Updated "Implement login flow"
- [12/4] task_comment: Added comment on "Fix navigation bug"
- [12/3] task: Completed "Setup CI/CD pipeline"
```

## Error Handling

```typescript
try {
  // ... fetch data
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('401')) {
      console.error('Authentication failed. Check TEAMWORK_BEARER_TOKEN.');
    } else if (error.message.includes('403')) {
      console.error('Permission denied. You may not have access to this data.');
    } else {
      console.error('Error fetching activity:', error.message);
    }
  }
}
```

## Success Criteria

- [ ] Current user ID retrieved successfully
- [ ] Time entries fetched for the date range
- [ ] Activity feed retrieved (optional, may be empty)
- [ ] Summary report generated with totals

---

## Frontend Integration: Multi-Agent Card Display

The Teamwork Frontend (`apps/teamwork_frontend/`) provides a visual interface with intelligent card display using a multi-agent architecture.

### Architecture

```
User Query ("How many hours last 7 months?")
         ↓
Server: Dynamic period parsing + Teamwork API fetch
         ↓
Main Agent (Opus via CLI): Analyzes data, responds with [[DISPLAY:cards]]
         ↓
CardAgent (Haiku via API): Formats time entries as structured cards
         ↓
Frontend: Renders cards in data display panel
```

### Display Hints

The main agent (Opus) includes display hints in its response to trigger visual data display:

- `[[DISPLAY:cards]]` - Show time entries as cards
- `[[DISPLAY:graph:hours_by_day]]` - Show hours over time chart (future)
- `[[DISPLAY:graph:hours_by_project]]` - Show project breakdown chart (future)

### CardAgent System Prompt

Location: `prompts/agents/card-agent.txt`

The CardAgent (Haiku) formats time entries as structured JSON:

```json
{
  "cards": [
    {
      "id": "string",
      "type": "timelog",
      "projectName": "Project Name",
      "taskName": "Task Name",
      "hours": 7.5,
      "date": "2024-12-04",
      "description": "Brief description"
    }
  ],
  "summary": {
    "totalHours": 45.5,
    "totalEntries": 12,
    "totalTasks": 5,
    "periodLabel": "Last 7 months"
  }
}
```

### Starting the Frontend

```bash
cd apps/teamwork_frontend

# Start backend (port 3051)
bun run server.ts

# Start frontend (port 3050, in another terminal)
npx vite --host
```

### Example Queries

In the frontend chat (Status mode):

- "How many hours did I log last 7 months?"
- "What did I work on this week?"
- "Show my activity for the past 2 weeks"
- "Total hours logged all time"

The response will include both:
1. **Text analysis** from Opus with insights
2. **Visual cards** in the data panel formatted by the CardAgent

### Related Files

- `apps/teamwork_frontend/server.ts` - Backend with streaming + CardAgent integration
- `apps/teamwork_frontend/services/agentService.ts` - CardAgent orchestration
- `prompts/agents/card-agent.txt` - Haiku formatting instructions
- `prompts/teamwork-cli/status.txt` - Main agent (Opus) status prompt
