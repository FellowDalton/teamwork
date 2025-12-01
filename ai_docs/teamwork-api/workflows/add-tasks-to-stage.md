# Add Tasks to Stage

Add multiple tasks to a workflow stage.

## Endpoint

```
POST /projects/api/v3/workflows/{workflowId}/stages/{stageId}/tasks.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | integer | Yes | Identifier for the workflow |
| `stageId` | integer | Yes | Identifier for the stage |

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskIds` | array[integer] | Yes | Array of task IDs to add to the stage |
| `options` | object | No | Additional options for the operation |

## Request Example

```json
{
  "taskIds": [1001, 1002, 1003],
  "options": {}
}
```

## Response

### 204 No Content

Successful operation. No response body.

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

### 404 Not Found

Resource doesn't exist.

### 409 Conflict

Operation cannot be completed due to conflict.

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

## Example Request

```bash
curl -X POST "https://yoursite.teamwork.com/projects/api/v3/workflows/123/stages/456/tasks.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskIds": [1001, 1002, 1003]
  }'
```

## Notes

- This is a bulk operation that adds multiple tasks at once
- Tasks must exist and be accessible to the authenticated user
- If a task is already in the stage, it will be skipped
- Use this endpoint to move tasks between stages by first removing from one stage and adding to another
