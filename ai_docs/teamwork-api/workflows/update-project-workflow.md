# Update Project Workflow

Update an existing project workflow. Can be used to map previous stages to new ones.

## Endpoint

```
PATCH /projects/api/v3/projects/{projectId}/workflows/{id}.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | integer | Yes | The project identifier |
| `id` | integer | Yes | The workflow identifier |

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflow` | object | Yes | Workflow data including stages, status, and metadata |
| `workflowOptions` | object | No | Additional configuration settings |

### Workflow Object

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Workflow ID |
| `name` | string | Workflow name |
| `status` | string | Workflow status |
| `stages` | array | Stage configuration |

## Request Example

```json
{
  "workflow": {
    "id": 123,
    "name": "Updated Workflow",
    "stages": [
      {"id": 1001, "name": "Backlog"},
      {"id": 1002, "name": "In Progress"},
      {"id": 1003, "name": "Review"},
      {"id": 1004, "name": "Done"}
    ]
  },
  "workflowOptions": {}
}
```

## Response

### 200 OK

```json
{
  "workflow": {
    "id": 0,
    "name": "string",
    "status": "string",
    "createdAt": "string",
    "createdBy": 0,
    "updatedAt": "string",
    "updatedBy": 0,
    "defaultWorkflow": false,
    "projectSpecific": true,
    "projectIds": [0],
    "stages": [
      {
        "id": 0,
        "name": "string",
        "color": "string"
      }
    ]
  },
  "included": {
    "companies": {},
    "projects": {},
    "stages": {},
    "teams": {},
    "users": {}
  },
  "meta": {
    "page": {
      "count": 0,
      "hasMore": false
    }
  }
}
```

### 400 Bad Request

Invalid request parameters or malformed data structure.

### 403 Forbidden

Insufficient permissions to modify this workflow.

### 404 Not Found

Workflow or project not found.

### 409 Conflict

Conflict in workflow state or stage mapping.

## Error Response Format

```json
{
  "errors": [
    {
      "code": "string",
      "title": "string",
      "detail": "string",
      "id": "string",
      "meta": {}
    }
  ]
}
```

## Example Request

```bash
curl -X PATCH "https://yoursite.teamwork.com/projects/api/v3/projects/789/workflows/123.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "name": "Updated Development Pipeline"
    }
  }'
```

## Example Response

```json
{
  "workflow": {
    "id": 123,
    "name": "Updated Development Pipeline",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": 456,
    "updatedAt": "2024-01-25T16:00:00Z",
    "updatedBy": 456,
    "projectIds": [789],
    "stages": [
      {"id": 1001, "name": "To Do", "color": "#3498db"},
      {"id": 1002, "name": "In Progress", "color": "#f39c12"},
      {"id": 1003, "name": "Done", "color": "#27ae60"}
    ]
  },
  "included": {
    "stages": {},
    "users": {
      "456": {
        "id": 456,
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  }
}
```

## Notes

- This endpoint can be used to update workflow properties or remap stages
- When updating stages, ensure proper mapping to prevent data loss
- The `updatedAt` and `updatedBy` fields are automatically updated
- Use this endpoint for modifying workflow configuration on a per-project basis
