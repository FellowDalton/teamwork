# Get Tasks in a Stage

Retrieve tasks within a specific workflow stage with extensive filtering capabilities.

## Endpoint

```
GET /projects/api/v3/workflows/{workflowId}/stages/{stageId}/tasks
```

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | integer | Yes | Workflow identifier |
| `stageId` | integer | Yes | Stage identifier |

## Query Parameters

### Pagination

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 50 | Items per page |
| `cursor` | string | - | Pagination cursor |
| `limit` | integer | - | Item count when using cursor |

### Task Filtering

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskFilter` | string | Predefined filters: all, completed, overdue, today, tomorrow, within7, within30, nodate, etc. |
| `searchTerm` | string | Search task names |
| `priority` | string | Filter by priority level |
| `status` | array | Filter by task status (upcoming, late, all) |

### Date Filtering

| Parameter | Type | Description |
|-----------|------|-------------|
| `dueBefore` | string | Due date before |
| `dueAfter` | string | Due date after |
| `updatedBefore` | string | Updated before |
| `updatedAfter` | string | Updated after |
| `createdBefore` | string | Created before |
| `createdAfter` | string | Created after |

### Custom Fields

Custom field filtering uses the syntax: `customField[id][op]=value`

| Operator | Description |
|----------|-------------|
| `eq` | Equal to |
| `like` | Contains |
| `not-like` | Does not contain |
| `gt` | Greater than |
| `lt` | Less than |
| `not` | Not equal to |
| `any` | Any value |

### Ordering

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `orderBy` | string | duedate | Sort field: startdate, priority, project, createdat, taskname, stage, etc. |
| `orderMode` | string | asc | Sort direction: asc or desc |

### Include Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | array | Related entities: projects, users, companies, teams, comments, attachments, tags, cards, etc. |
| `includeCustomFields` | boolean | Include custom field data |
| `includeCommentStats` | boolean | Include comment statistics |
| `includeAttachmentCommentStats` | boolean | Include attachment comment stats |
| `nestSubTasks` | boolean | Nest subtasks within parent tasks |
| `getFiles` | boolean | Include file attachments |
| `includeRelatedTasks` | boolean | Include related tasks |

## Response

### 200 OK

```json
{
  "tasks": [
    {
      "id": 0,
      "name": "string",
      "description": "string",
      "status": "string",
      "priority": "string",
      "dueDate": "string",
      "startDate": "string",
      "completedAt": "string",
      "assigneeUserIds": [0],
      "assigneeTeamIds": [0],
      "assigneeCompanyIds": [0],
      "parentTaskId": 0,
      "subTaskIds": [0],
      "tagIds": [0],
      "estimateMinutes": 0,
      "progress": 0,
      "isPrivate": false,
      "isArchived": false,
      "workflowStages": [
        {
          "stageId": 0,
          "stageTaskDisplayOrder": 0,
          "workflowId": 0
        }
      ]
    }
  ],
  "included": {
    "cards": {},
    "columns": {},
    "comments": {},
    "companies": {},
    "customfields": {},
    "files": {},
    "lockdowns": {},
    "milestones": {},
    "projects": {},
    "teams": {},
    "timers": {},
    "users": {},
    "workflows": {},
    "tasklists": {},
    "tags": {}
  },
  "meta": {
    "page": {
      "count": 0,
      "hasMore": true,
      "pageOffset": 0,
      "pageSize": 0
    },
    "limit": 0,
    "totalCapacity": 0,
    "averageSpend": 0
  }
}
```

### 400 Bad Request

Returns an ErrorResponse for invalid parameters.

## Task Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique task identifier |
| `name` | string | Task name |
| `description` | string | Task description |
| `status` | string | Task status |
| `priority` | string | Priority level |
| `dueDate` | string | Due date |
| `startDate` | string | Start date |
| `completedAt` | string | Completion timestamp |
| `assigneeUserIds` | array[integer] | Assigned user IDs |
| `assigneeTeamIds` | array[integer] | Assigned team IDs |
| `assigneeCompanyIds` | array[integer] | Assigned company IDs |
| `parentTaskId` | integer | Parent task ID (for subtasks) |
| `subTaskIds` | array[integer] | Child task IDs |
| `tagIds` | array[integer] | Associated tag IDs |
| `estimateMinutes` | integer | Time estimate in minutes |
| `progress` | integer | Completion percentage |
| `isPrivate` | boolean | Private task flag |
| `isArchived` | boolean | Archived task flag |
| `workflowStages` | array | Workflow stage assignments |

## Example Request

```bash
curl -X GET "https://yoursite.teamwork.com/projects/api/v3/workflows/123/stages/456/tasks?pageSize=25&orderBy=priority&orderMode=desc&include=users,tags" \
  -H "Authorization: Basic YOUR_API_KEY"
```

## Example Response

```json
{
  "tasks": [
    {
      "id": 1001,
      "name": "Implement login feature",
      "status": "in_progress",
      "priority": "high",
      "dueDate": "2024-02-01",
      "assigneeUserIds": [789],
      "workflowStages": [
        {
          "stageId": 456,
          "stageTaskDisplayOrder": 1,
          "workflowId": 123
        }
      ]
    }
  ],
  "meta": {
    "page": {
      "count": 1,
      "hasMore": false,
      "pageSize": 25
    }
  }
}
```
