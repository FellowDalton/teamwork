# Create a New Workflow

Create a new workflow in the Teamwork system.

## Endpoint

```
POST /projects/api/v3/workflows.json
```

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflow` | object | Yes | Workflow object containing workflow information |
| `workflowOptions` | object | No | Configuration options for the workflow |

### Workflow Object

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Workflow name |
| `defaultWorkflow` | boolean | Whether this is the default workflow |
| `projectSpecific` | boolean | Whether workflow is project-specific |
| `status` | string | Workflow status |

## Request Example

```json
{
  "workflow": {
    "name": "My New Workflow",
    "defaultWorkflow": false,
    "projectSpecific": true,
    "status": "active"
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
    "defaultWorkflow": true,
    "projectSpecific": true,
    "status": "string",
    "stages": [
      {
        "id": 0,
        "meta": {},
        "type": "string"
      }
    ],
    "projectIds": [0],
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
      "pageSize": 0,
      "pageOffset": 0,
      "hasMore": true
    }
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
| `workflow.id` | integer | Auto-generated unique identifier |
| `workflow.name` | string | Workflow name |
| `workflow.createdAt` | string | Creation timestamp |
| `workflow.createdBy` | integer | Creator user ID |
| `workflow.updatedAt` | string | Last modification timestamp |
| `workflow.updatedBy` | integer | Last modifier user ID |
| `workflow.defaultWorkflow` | boolean | Default workflow flag |
| `workflow.projectSpecific` | boolean | Project-specific flag |
| `workflow.status` | string | Workflow status |
| `workflow.stages` | array | Associated stages |
| `workflow.projectIds` | array[integer] | Associated project IDs |

## Included Objects

The response may include related entities based on the workflow configuration:

- `companies` - Company information
- `projects` - Project details
- `stages` - Stage information (color, displayOrder, taskIds)
- `teams` - Team details
- `users` - User information

## Example Request

```bash
curl -X POST "https://yoursite.teamwork.com/projects/api/v3/workflows.json" \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "name": "Development Pipeline",
      "defaultWorkflow": false,
      "projectSpecific": false,
      "status": "active"
    }
  }'
```
