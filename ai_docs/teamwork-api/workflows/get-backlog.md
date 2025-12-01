# Get Backlog Tasks

Retrieve tasks that have not been assigned to any stage in a workflow (backlog).

## Endpoint

```
GET /projects/api/v3/workflows/{workflowId}/backlog
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | integer | Yes | Workflow identifier |

## Query Parameters

### Date Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `updatedBefore` | string | Filter by update date |
| `updatedAfter` | string | Filter by update date |
| `createdBefore` | string | Filter by creation date |
| `createdAfter` | string | Filter by creation date |
| `dueBefore` | string | Filter by due date |
| `dueAfter` | string | Filter by due date |
| `completedBefore` | string | Filter by completion date |
| `completedAfter` | string | Filter by completion date |

### Task Filtering

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskFilter` | string | Predefined filters: all, completed, overdue, today, nodate, etc. |
| `priority` | string | Filter by priority level |
| `status` | array | Filter by task status |
| `searchTerm` | string | Search task names |

### Pagination

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 50 | Items per page |
| `cursor` | string | - | Pagination cursor |
| `limit` | integer | - | Item count when using cursor |

### Sorting

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `orderBy` | string | duedate | Sort field: startdate, priority, taskname, stage, createdat, etc. |
| `orderMode` | string | asc | Sort direction |

### Custom Fields

Custom field filtering uses the syntax: `customField[id][op]=value`

Supported operators: `like`, `not-like`, `eq`, `not`, `lt`, `gt`, `any`

### Include Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | array | Related entities: projects, users, teams, comments, tags, cards, etc. |

## Response

### 200 OK

```json
{
  "tasks": [
    {
      "id": 0,
      "name": "string",
      "description": "string",
      "dueDate": "string",
      "startDate": "string",
      "completedAt": "string",
      "assigneeUserIds": [0],
      "assigneeTeamIds": [0],
      "assigneeCompanyIds": [0],
      "priority": "string",
      "status": "string",
      "progress": 0,
      "estimateMinutes": 0,
      "tagIds": [0],
      "workflowStages": []
    }
  ],
  "included": {
    "projects": {},
    "users": {},
    "teams": {},
    "cards": {},
    "comments": {}
  },
  "meta": {
    "page": {
      "count": 0,
      "hasMore": true,
      "pageSize": 0
    },
    "nextCursor": "string",
    "limit": 0
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
| `dueDate` | string | Due date |
| `startDate` | string | Start date |
| `completedAt` | string | Completion timestamp |
| `assigneeUserIds` | array[integer] | Assigned user IDs |
| `assigneeTeamIds` | array[integer] | Assigned team IDs |
| `assigneeCompanyIds` | array[integer] | Assigned company IDs |
| `priority` | string | Priority level |
| `status` | string | Task status |
| `progress` | integer | Completion percentage |
| `estimateMinutes` | integer | Time estimate in minutes |
| `tagIds` | array[integer] | Associated tag IDs |
| `workflowStages` | array | Empty for backlog tasks |

## Example Request

```bash
curl -X GET "https://yoursite.teamwork.com/projects/api/v3/workflows/123/backlog?pageSize=25&orderBy=priority&orderMode=desc" \
  -H "Authorization: Basic YOUR_API_KEY"
```

## Example Response

```json
{
  "tasks": [
    {
      "id": 2001,
      "name": "Unassigned task",
      "status": "new",
      "priority": "medium",
      "dueDate": "2024-02-15",
      "assigneeUserIds": [],
      "workflowStages": []
    },
    {
      "id": 2002,
      "name": "Another backlog item",
      "status": "new",
      "priority": "low",
      "assigneeUserIds": [789],
      "workflowStages": []
    }
  ],
  "meta": {
    "page": {
      "count": 2,
      "hasMore": false,
      "pageSize": 25
    }
  }
}
```

## Notes

- Backlog tasks are those that exist in a project with a workflow but haven't been assigned to any stage
- This endpoint supports the same extensive filtering as the stage tasks endpoint
- Use the "Add Tasks to Stage" endpoint to move backlog tasks into a workflow stage
