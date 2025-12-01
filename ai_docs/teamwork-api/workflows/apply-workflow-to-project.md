# Apply Workflow to Project

Apply a workflow to a specific project.

## Endpoint

```
POST /projects/api/v3/projects/{projectId}/workflows.json
```

## Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | integer | Yes | The identifier for the target project |

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflow` | object | Yes | Workflow object containing workflow information |
| `workflowOptions` | object | No | Configuration options for workflow application |

### Workflow Object

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Workflow ID to apply |
| `name` | string | Workflow name |

## Request Example

```json
{
  "workflow": {
    "id": 123,
    "name": "Standard Workflow"
  },
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
        "type": "string"
      }
    ],
    "status": "string",
    "lockdown": {
      "id": 0,
      "meta": {},
      "type": "string"
    }
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
      "pageSize": 50
    }
  }
}
```

### 400 Bad Request

Invalid request format or missing required fields.

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

Insufficient permissions to apply workflow.

## Response Properties

| Property | Type | Description |
|----------|------|-------------|
| `workflow.id` | integer | Workflow identifier |
| `workflow.name` | string | Workflow name |
| `workflow.createdAt` | string | Creation timestamp |
| `workflow.createdBy` | integer | Creator user ID |
| `workflow.updatedAt` | string | Last modification timestamp |
| `workflow.updatedBy` | integer | Last modifier user ID |
| `workflow.defaultWorkflow` | boolean | Default workflow flag |
| `workflow.projectSpecific` | boolean | Project-specific flag |
| `workflow.projectIds` | array[integer] | Associated project IDs |
| `workflow.stages` | array | Workflow stages |
| `workflow.status` | string | Workflow status |

## Included Resources

The response includes related entity data:

- `companies` - Company information with account details, contact info
- `projects` - Project details
- `stages` - Stage information with color, display order, task associations
- `teams` - Team identification and branding
- `users` - User contact and permission data

## Example Request

```bash
curl -X POST "https://yoursite.teamwork.com/projects/api/v3/projects/789/workflows.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "id": 123
    }
  }'
```

## Example Response

```json
{
  "workflow": {
    "id": 123,
    "name": "Development Pipeline",
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": 456,
    "updatedAt": "2024-01-15T10:30:00Z",
    "updatedBy": 456,
    "defaultWorkflow": false,
    "projectSpecific": false,
    "projectIds": [789],
    "stages": [
      {"id": 1001, "type": "stage"},
      {"id": 1002, "type": "stage"},
      {"id": 1003, "type": "stage"}
    ],
    "status": "active"
  },
  "included": {
    "stages": {
      "1001": {"id": 1001, "name": "To Do", "color": "#3498db"},
      "1002": {"id": 1002, "name": "In Progress", "color": "#f39c12"},
      "1003": {"id": 1003, "name": "Done", "color": "#27ae60"}
    }
  },
  "meta": {
    "page": {
      "count": 1,
      "pageSize": 50
    }
  }
}
```

## Notes

- Applying a workflow to a project enables kanban-style task management for that project
- A project can only have one workflow applied at a time
- Existing tasks in the project will need to be assigned to stages
