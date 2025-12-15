# Workflow: Create Project

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
</required_reading>

<process>
## Overview

This workflow helps users create a new Teamwork project through an interactive conversation. The agent will:
1. Gather project requirements through clarifying questions
2. Build a draft project structure
3. Display it for user review
4. Create the project and all components on approval

## Step 1: Gather Requirements

Ask clarifying questions to understand the project:

**Project Basics:**
- What is the project name?
- Brief description of the project
- Start and end dates (if known)

**Task Structure:**
- What are the main phases or categories? (become task lists)
- What tasks need to be done in each phase?
- Are there subtasks to break down larger items?
- What are the deadlines for key tasks?

**Additional Configuration:**
- Budget requirements (hours or money)?
- Any specific tags to apply?
- Who should have access?

**Example Questions:**
```
"What would you like to call this project?"
"Can you describe the main goal or scope?"
"What are the main phases or categories of work?"
"Do you have a timeline in mind?"
"Would you like to set up a budget for tracking?"
```

## Step 2: Process User Input / Files

If the user provides specification documents or requirements:

```typescript
// Parse the content to extract:
// - Project goals -> description
// - Phases/milestones -> task lists
// - Requirements/features -> tasks
// - Sub-requirements -> subtasks
// - Deadlines -> due dates
```

Suggest a task structure based on the input:
- Group related items into task lists
- Break large items into subtasks
- Assign appropriate priorities based on importance/dependencies

## Step 3: Build Draft Structure

Create a draft object for display:

```typescript
const projectDraft: ProjectDraftData = {
  project: {
    name: "Project Name",
    description: "Project description...",
    startDate: "2024-01-15",
    endDate: "2024-06-30",
    tags: [
      { name: "client-work", color: "f44336" },
      { name: "priority", isNew: true }
    ]
  },
  tasklists: [
    {
      id: "tl-1",
      name: "Phase 1: Discovery",
      description: "Initial research and planning",
      tasks: [
        {
          id: "t-1",
          name: "Stakeholder interviews",
          description: "Meet with key stakeholders",
          priority: "high",
          dueDate: "2024-01-20",
          tags: [{ name: "research" }],
          subtasks: [
            {
              id: "st-1",
              name: "Schedule meetings",
              dueDate: "2024-01-16"
            },
            {
              id: "st-2",
              name: "Prepare interview questions"
            }
          ]
        },
        {
          id: "t-2",
          name: "Requirements document",
          priority: "high",
          dueDate: "2024-01-25",
          tags: [],
          subtasks: []
        }
      ]
    },
    {
      id: "tl-2",
      name: "Phase 2: Development",
      tasks: [
        // ... more tasks
      ]
    }
  ],
  budget: {
    type: "time",
    capacity: 160,
    timelogType: "billable"
  },
  summary: {
    totalTasklists: 2,
    totalTasks: 5,
    totalSubtasks: 3
  },
  message: "Here's your project structure. Review and click Create when ready.",
  isDraft: true
};
```

Present this to the user in the display panel for review.

## Step 4: Create on Approval

When the user approves, execute the API calls in sequence:

```typescript
import { createTeamworkClient } from './apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// 1. Create the project
const projectResult = await client.projects.create({
  name: projectDraft.project.name,
  description: projectDraft.project.description,
  startDate: projectDraft.project.startDate?.replace(/-/g, ''),  // Convert to yyyymmdd
  endDate: projectDraft.project.endDate?.replace(/-/g, ''),
  useTasks: true,
  useTime: true,
  useMilestones: true,
});

const projectId = parseInt(projectResult.id, 10);
console.log(`Created project: ${projectId}`);

// 2. Create/find tags
const tagIds: number[] = [];
for (const tag of projectDraft.project.tags) {
  if (tag.id) {
    tagIds.push(tag.id);
  } else if (tag.isNew) {
    const newTag = await client.tags.findOrCreate(tag.name, tag.color);
    tagIds.push(newTag.id);
  }
}

// 3. Create task lists
for (const tasklist of projectDraft.tasklists) {
  const tasklistResult = await client.projects.createTasklist(projectId, {
    name: tasklist.name,
    description: tasklist.description,
  });
  
  const tasklistId = parseInt(tasklistResult.id, 10);
  console.log(`Created tasklist: ${tasklistId} - ${tasklist.name}`);
  
  // 4. Create tasks in each list
  for (const task of tasklist.tasks) {
    // Get tag IDs for this task
    const taskTagIds: number[] = [];
    for (const tag of task.tags) {
      if (tag.id) {
        taskTagIds.push(tag.id);
      } else {
        const existingTag = await client.tags.findByName(tag.name);
        if (existingTag) taskTagIds.push(existingTag.id);
      }
    }
    
    const createdTask = await client.tasks.create(tasklistId, {
      name: task.name,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      startDate: task.startDate,
      estimatedMinutes: task.estimatedMinutes,
      tagIds: taskTagIds.length > 0 ? taskTagIds : undefined,
    });
    
    console.log(`Created task: ${createdTask.id} - ${task.name}`);
    
    // 5. Create subtasks
    for (const subtask of task.subtasks) {
      const subtaskResponse = await client.http.post(
        `/projects/api/v3/tasks/${createdTask.id}/subtasks.json`,
        {
          task: {
            name: subtask.name,
            description: subtask.description,
            dueDate: subtask.dueDate,
            estimatedMinutes: subtask.estimatedMinutes,
          }
        }
      );
      console.log(`Created subtask: ${subtask.name}`);
    }
  }
}

// 6. Set up budget (if specified)
if (projectDraft.budget) {
  // Budget creation via API
  // Note: May require additional endpoint implementation
  console.log(`Budget: ${projectDraft.budget.capacity} ${projectDraft.budget.type === 'time' ? 'hours' : 'dollars'}`);
}

console.log(`\nProject "${projectDraft.project.name}" created successfully!`);
console.log(`View at: ${process.env.TEAMWORK_API_URL}/app/projects/${projectId}`);
```

## Step 5: Report Success

After creation, provide a summary:
- Project name and URL
- Number of task lists created
- Number of tasks and subtasks created
- Budget details (if set)

```
"I've created your project 'Mobile App Redesign' with:
- 4 task lists (Discovery, Design, Development, Testing)
- 15 tasks with 8 subtasks
- Budget: 160 hours (billable)

You can view it here: https://yoursite.teamwork.com/app/projects/12345"
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Project requirements gathered from user
- [ ] Draft structure built and displayed for review
- [ ] User approved the project structure
- [ ] Project created via API
- [ ] Task lists created
- [ ] Tasks and subtasks created
- [ ] Tags applied (existing or new)
- [ ] Budget configured (if requested)
- [ ] Success message with project URL provided
</success_criteria>

<tips>
- Always show the draft before creating - users should review
- Group related tasks into logical task lists
- Use high priority sparingly - for truly critical items
- Estimate time in hours, API expects minutes
- Date format for API: yyyymmdd (no dashes)
- Tags can be reused across projects
</tips>
