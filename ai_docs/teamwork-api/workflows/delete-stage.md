# Delete an Existing Stage

Delete a workflow stage and optionally migrate tasks to another stage.

## Endpoint

```
DELETE /projects/api/v3/workflows/{workflowId}/stages/{stageId}.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflowId` | integer | Yes | Identifier for the workflow |
| `stageId` | integer | Yes | Identifier for the stage to delete |

## Request Body

No request body required. Tasks within the deleted stage must be migrated to another stage.

## Response

### 204 No Content

Stage successfully deleted. No response body.

### 400 Bad Request

Invalid parameters or operation conflict.

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

Insufficient permissions for deletion.

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

Workflow or stage not found.

## Example Request

```bash
curl -X DELETE "https://yoursite.teamwork.com/projects/api/v3/workflows/123/stages/456.json" \
  -H "Authorization: Basic YOUR_API_KEY"
```

## Notes

- Successful deletion returns HTTP 204 with no response body
- Tasks within the deleted stage should be migrated to another stage before deletion
- Authentication required (API key or valid session)
- This operation cannot be undone
