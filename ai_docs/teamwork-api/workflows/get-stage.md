# Get a Specific Stage

Retrieve a specific stage by ID within a workflow.

## Endpoint

```
GET /projects/api/v3/workflows/{workflowId}/stages/{stageId}.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | integer | Yes | The workflow identifier |
| `stageId` | integer | Yes | The stage identifier |

## Request

No request body required for this GET operation.

## Response

### 200 OK

```json
{
  "stage": {
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
  },
  "included": {
    "users": {},
    "workflows": {}
  }
}
```

### 400 Bad Request

Returns an ErrorResponse with validation errors.

### 404 Not Found

Stage or workflow does not exist.

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
| `deletedAt` | string | Deletion timestamp (if soft-deleted) |
| `deletedBy` | integer | User who deleted (if soft-deleted) |
| `workflow` | object | Parent workflow reference |

## Example Request

```bash
curl -X GET "https://yoursite.teamwork.com/projects/api/v3/workflows/123/stages/456.json" \
  -H "Authorization: Basic YOUR_API_KEY"
```

## Example Response

```json
{
  "stage": {
    "id": 456,
    "name": "In Progress",
    "color": "#f39c12",
    "displayOrder": 2,
    "showCompletedTasks": false,
    "taskIds": [1001, 1002, 1003],
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": 789,
    "updatedAt": "2024-01-20T14:45:00Z",
    "updatedBy": 789,
    "workflow": {
      "id": 123,
      "type": "workflow"
    }
  },
  "included": {
    "workflows": {
      "123": {
        "id": 123,
        "name": "Development Pipeline"
      }
    }
  }
}
```
