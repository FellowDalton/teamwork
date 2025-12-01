# Apply Workflow to Multiple Projects

Apply a workflow to multiple projects at once.

## Endpoint

```
POST /projects/api/v3/projects/workflows/{id}.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | integer | Yes | Workflow identifier to apply |

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projects` | array | Yes | Collection of project mapping objects |
| `workflowOptions` | object | No | Configuration settings for workflow application |

### Project Mapping Object

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Project ID to apply workflow to |

## Request Example

```json
{
  "projects": [
    {"id": 101},
    {"id": 102},
    {"id": 103}
  ],
  "workflowOptions": {}
}
```

## Response

### 201 Created

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
    "projectSpecific": false,
    "projectIds": [0],
    "stages": [
      {
        "id": 0,
        "type": "string"
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
      "hasMore": true
    }
  }
}
```

### 400 Bad Request

Returns an ErrorResponse with validation failures.

### 403 Forbidden

Returns an ErrorResponse indicating insufficient permissions.

## Example Request

```bash
curl -X POST "https://yoursite.teamwork.com/projects/api/v3/projects/workflows/123.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projects": [
      {"id": 101},
      {"id": 102},
      {"id": 103}
    ]
  }'
```

## Example Response

```json
{
  "workflow": {
    "id": 123,
    "name": "Development Pipeline",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": 456,
    "projectIds": [101, 102, 103],
    "stages": [
      {"id": 1001, "type": "stage"},
      {"id": 1002, "type": "stage"},
      {"id": 1003, "type": "stage"}
    ]
  },
  "included": {
    "projects": {
      "101": {"id": 101, "name": "Project Alpha"},
      "102": {"id": 102, "name": "Project Beta"},
      "103": {"id": 103, "name": "Project Gamma"}
    },
    "stages": {
      "1001": {"id": 1001, "name": "To Do"},
      "1002": {"id": 1002, "name": "In Progress"},
      "1003": {"id": 1003, "name": "Done"}
    }
  },
  "meta": {
    "page": {
      "count": 3,
      "hasMore": false
    }
  }
}
```

## Notes

- This is a bulk operation for applying a single workflow to multiple projects
- Each project in the array must be accessible to the authenticated user
- If a project already has the workflow applied, it will be skipped
- Use this endpoint when setting up workflows across multiple projects simultaneously
