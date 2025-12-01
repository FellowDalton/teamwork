# Remove Workflow from Project

Remove an existing workflow from a project.

## Endpoint

```
DELETE /projects/api/v3/projects/{projectId}/workflows/{id}.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | integer | Yes | The project identifier |
| `id` | integer | Yes | The workflow identifier |

## Request Body

No request body required for this DELETE operation.

## Response

### 204 No Content

Operation successful. No response body.

### 400 Bad Request

Invalid parameters or malformed request.

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

Specified project or workflow doesn't exist.

## Example Request

```bash
curl -X DELETE "https://yoursite.teamwork.com/projects/api/v3/projects/789/workflows/123.json" \
  -H "Authorization: Basic YOUR_API_KEY"
```

## Example Responses

### Successful Response (204)

```
[No Content]
```

### Error Response (400)

```json
{
  "errors": [
    {
      "code": "INVALID_REQUEST",
      "detail": "Workflow is not applied to this project",
      "id": "err_001",
      "meta": {},
      "title": "Bad Request"
    }
  ]
}
```

### Error Response (403)

```json
{
  "errors": [
    {
      "code": "INSUFFICIENT_PERMISSIONS",
      "detail": "You do not have permission to remove this workflow",
      "id": "err_002",
      "meta": {},
      "title": "Forbidden"
    }
  ]
}
```

## Notes

- Successful deletion returns HTTP 204 with no response body
- Removing a workflow from a project does not delete the workflow itself
- Tasks in the project will no longer be associated with workflow stages
- Consider migrating tasks to another workflow or stage structure before removal
- This operation cannot be undone
- The workflow can be re-applied to the project later if needed
