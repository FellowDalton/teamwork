# Create a New Stage

Create a new stage for a workflow.

## Endpoint

```
POST /projects/api/v3/workflows/{workflowId}/stages.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | integer | Yes | Identifier for the target workflow |

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stage` | object | Yes | Stage object containing stage information |
| `stageOptions` | object | No | Additional configuration options for stage creation |

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
    "color": "#9b59b6",
    "displayOrder": 3,
    "showCompletedTasks": false
  },
  "stageOptions": {}
}
```

## Response

### 201 Created

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

## Response Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `stage.id` | integer | Auto-generated unique identifier |
| `stage.name` | string | Stage name |
| `stage.color` | string | Stage color |
| `stage.displayOrder` | integer | Position in workflow sequence |
| `stage.showCompletedTasks` | boolean | Show completed tasks flag |
| `stage.taskIds` | array[integer] | Associated task IDs (empty on creation) |
| `stage.createdAt` | string | Creation timestamp |
| `stage.createdBy` | integer | Creator user ID |
| `stage.updatedAt` | string | Last modification timestamp |
| `stage.updatedBy` | integer | Last modifier user ID |
| `stage.workflow` | object | Parent workflow reference |

## Example Request

```bash
curl -X POST "https://yoursite.teamwork.com/projects/api/v3/workflows/123/stages.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stage": {
      "name": "Code Review",
      "color": "#9b59b6",
      "displayOrder": 3,
      "showCompletedTasks": false
    }
  }'
```

## Notes

- The `displayOrder` controls where the stage appears in the workflow sequence
- Color should be a valid hex color code
- Timestamps and user attribution are automatically set for audit trails
