# Edit Task Position in Stage

Modify the position of a task within a workflow stage, allowing reordering of tasks.

## Endpoint

```
PATCH /projects/api/v3/tasks/{taskId}/workflows/{workflowId}.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `taskId` | integer | Yes | The identifier of the task being repositioned |
| `workflowId` | integer | Yes | The identifier of the workflow containing the task |

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionAfterTask` | integer | Yes | Task ordering reference: use -1 for top of list, or specify another task's ID |
| `stageId` | integer | Yes | The stage where the task should be positioned |
| `taskId` | integer | Yes | The task being moved |
| `workflowId` | integer | Yes | The workflow identifier |

## Request Example

```json
{
  "taskId": 1001,
  "workflowId": 123,
  "stageId": 456,
  "positionAfterTask": 1000
}
```

### Positioning Logic

- `positionAfterTask: -1` - Place task at the top of the stage
- `positionAfterTask: <taskId>` - Place task after the specified task

## Response

### 200 OK

Returns information about the stage after the reposition.

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

Invalid parameters.

```json
{
  "errors": [
    {
      "code": "string",
      "detail": "string",
      "id": "string",
      "meta": {},
      "title": "string"
    }
  ]
}
```

### 403 Forbidden

Insufficient permissions.

### 404 Not Found

Task, workflow, or stage not found.

### 409 Conflict

Operation cannot be completed (e.g., task not in workflow).

## Example Request

### Move task to top of stage

```bash
curl -X PATCH "https://yoursite.teamwork.com/projects/api/v3/tasks/1001/workflows/123.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": 1001,
    "workflowId": 123,
    "stageId": 456,
    "positionAfterTask": -1
  }'
```

### Move task after another task

```bash
curl -X PATCH "https://yoursite.teamwork.com/projects/api/v3/tasks/1001/workflows/123.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": 1001,
    "workflowId": 123,
    "stageId": 456,
    "positionAfterTask": 1000
  }'
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
    "taskIds": [1001, 1000, 1002],
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": 789,
    "updatedAt": "2024-01-25T14:00:00Z",
    "updatedBy": 789,
    "workflow": {
      "id": 123,
      "type": "workflow"
    }
  }
}
```

## Notes

- This endpoint can also move a task between stages by specifying a different `stageId`
- The `taskIds` array in the response shows the new order of tasks in the stage
- Use this endpoint for drag-and-drop functionality in kanban-style boards
