# Update an Existing Stage

Update a stage by ID within a workflow.

## Endpoint

```
PATCH /projects/api/v3/workflows/{workflowId}/stages/{stageId}.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | integer | Yes | Identifier for the workflow |
| `stageId` | integer | Yes | Identifier for the stage |

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stage` | object | Yes | Stage object with properties to update |
| `stageOptions` | object | No | Additional configuration options |

### Stage Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Stage name |
| `color` | string | Stage color (hex code) |
| `displayOrder` | integer | Position in workflow |
| `showCompletedTasks` | boolean | Whether to show completed tasks |

## Request Example

```json
{
  "stage": {
    "name": "In Review",
    "color": "#e74c3c",
    "displayOrder": 3,
    "showCompletedTasks": true
  },
  "stageOptions": {}
}
```

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

### 403 Forbidden

Returns an ErrorResponse indicating insufficient permissions.

### 404 Not Found

Stage or workflow does not exist.

### 409 Conflict

Returns an ErrorResponse indicating a data integrity issue.

## Example Request

```bash
curl -X PATCH "https://yoursite.teamwork.com/projects/api/v3/workflows/123/stages/456.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stage": {
      "name": "QA Review",
      "color": "#e74c3c"
    }
  }'
```

## Example Response

```json
{
  "stage": {
    "id": 456,
    "name": "QA Review",
    "color": "#e74c3c",
    "displayOrder": 3,
    "showCompletedTasks": false,
    "taskIds": [1001, 1002],
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": 789,
    "updatedAt": "2024-01-25T09:00:00Z",
    "updatedBy": 789,
    "workflow": {
      "id": 123,
      "type": "workflow"
    }
  },
  "included": {
    "users": {
      "789": {
        "id": 789,
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  }
}
```

## Notes

- Only include properties you want to update in the request
- The `updatedAt` and `updatedBy` fields are automatically updated
- Changing `displayOrder` may affect the visual ordering of stages in the workflow
