# Get All Stages

Retrieve all stages for a specific workflow.

## Endpoint

```
GET /projects/api/v3/workflows/{workflowId}/stages.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | integer | Yes | Identifier for the workflow |

## Query Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `updatedAfter` | string | - | Filter results by modification date |
| `orderMode` | string | asc | Sort direction (asc/desc) |
| `orderBy` | string | id | Sort field (id/name/displayorder) |
| `cursor` | string | - | Pagination cursor for large datasets |
| `workflowId` | integer | - | Filter by specific workflow IDs |
| `pageSize` | integer | 50 | Items per page |
| `page` | integer | 1 | Page number |
| `limit` | integer | - | Item count when using cursor |
| `showDeleted` | boolean | - | Include removed stages in results |
| `include` | array[string] | - | Related data to include (workflows) |
| `ids` | array[integer] | - | Filter by specific stage identifiers |

### Field Selection Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields[workflows]` | array[string] | Workflow fields (id/name/statusId) |
| `fields[stages]` | array[string] | Stage fields (id/name/stage) |

## Response

### 200 OK

```json
{
  "stages": [
    {
      "id": 0,
      "name": "string",
      "color": "string",
      "displayOrder": 0,
      "showCompletedTasks": true,
      "taskIds": [0],
      "createdAt": "string",
      "createdBy": 0,
      "updatedAt": "string",
      "updatedBy": 0,
      "deletedAt": "string",
      "deletedBy": 0,
      "workflow": {
        "id": 0,
        "meta": {},
        "type": "string"
      }
    }
  ],
  "included": {
    "users": {},
    "workflows": {}
  },
  "meta": {
    "averageSpend": 0,
    "limit": 0,
    "nextCursor": "string",
    "prevCursor": "string",
    "totalCapacity": 0,
    "page": {
      "count": 0,
      "hasMore": true,
      "pageOffset": 0,
      "pageSize": 0
    }
  }
}
```

### 400 Bad Request

Returns an ErrorResponse object with validation errors.

## Stage Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique stage identifier |
| `name` | string | Stage name |
| `color` | string | Stage color (hex code) |
| `displayOrder` | integer | Position in workflow |
| `showCompletedTasks` | boolean | Whether to show completed tasks |
| `taskIds` | array[integer] | IDs of tasks in this stage |
| `createdAt` | string | Creation timestamp |
| `createdBy` | integer | Creator user ID |
| `updatedAt` | string | Last modification timestamp |
| `updatedBy` | integer | Last modifier user ID |
| `deletedAt` | string | Deletion timestamp (if deleted) |
| `deletedBy` | integer | User who deleted (if deleted) |
| `workflow` | object | Parent workflow reference |

## Example Request

```bash
curl -X GET "https://yoursite.teamwork.com/projects/api/v3/workflows/123/stages.json?orderBy=displayorder&orderMode=asc" \
  -H "Authorization: Basic YOUR_API_KEY"
```

## Example Response

```json
{
  "stages": [
    {
      "id": 1001,
      "name": "To Do",
      "color": "#3498db",
      "displayOrder": 1,
      "showCompletedTasks": false,
      "taskIds": [101, 102, 103],
      "createdAt": "2024-01-15T10:30:00Z",
      "createdBy": 456,
      "workflow": {
        "id": 123,
        "type": "workflow"
      }
    },
    {
      "id": 1002,
      "name": "In Progress",
      "color": "#f39c12",
      "displayOrder": 2,
      "showCompletedTasks": false,
      "taskIds": [104, 105],
      "createdAt": "2024-01-15T10:30:00Z",
      "createdBy": 456,
      "workflow": {
        "id": 123,
        "type": "workflow"
      }
    },
    {
      "id": 1003,
      "name": "Done",
      "color": "#27ae60",
      "displayOrder": 3,
      "showCompletedTasks": true,
      "taskIds": [106],
      "createdAt": "2024-01-15T10:30:00Z",
      "createdBy": 456,
      "workflow": {
        "id": 123,
        "type": "workflow"
      }
    }
  ],
  "meta": {
    "page": {
      "count": 3,
      "hasMore": false,
      "pageSize": 50
    }
  }
}
```
