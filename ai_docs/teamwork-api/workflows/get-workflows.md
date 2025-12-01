# Get All Workflows

Retrieve all workflows from the Teamwork system.

## Endpoint

```
GET /projects/api/v3/workflows.json
```

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `updatedAfter` | string | - | Filter results by modification date |
| `status` | string | - | Filter by workflow status |
| `searchTerm` | string | - | Filter by search term |
| `cursor` | string | - | Pagination cursor (ignores page/pageSize) |
| `pageSize` | integer | 50 | Items per page |
| `page` | integer | 1 | Page number |
| `limit` | integer | - | Items to return with cursor |
| `showDeleted` | boolean | false | Include deleted workflows |
| `onlyDefaultWorkflow` | boolean | false | Retrieve only default workflow |
| `matchAllStageNames` | boolean | - | Enforce all stage names matched |
| `includeTotalCount` | boolean | - | Include installation-wide totals |
| `includeArchived` | boolean | - | Include archived workflows |
| `workflowIds` | array[integer] | - | Filter by specific workflow IDs |
| `stageNames` | array[string] | - | Filter by exact stage names |
| `projectIds` | array[integer] | - | Filter by project IDs |
| `include` | array[string] | - | Include related data (projects, stages, users, teams, companies) |

### Field Selection Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields[workflows]` | array[string] | Select workflow fields (id, name, statusId) |
| `fields[users]` | array[string] | Select user fields (id, firstName, lastName, email, etc.) |
| `fields[teams]` | array[string] | Select team fields (id, name, teamLogo) |
| `fields[stages]` | array[string] | Select stage fields (id, name, stage) |
| `fields[projects]` | array[string] | Select project fields (id, name) |
| `fields[companies]` | array[string] | Select company fields (id, name, logoImage) |

## Response

### 200 OK

```json
{
  "workflows": [
    {
      "id": 0,
      "name": "string",
      "status": "string",
      "defaultWorkflow": true,
      "projectSpecific": true,
      "createdAt": "string",
      "updatedAt": "string",
      "createdBy": 0,
      "updatedBy": 0,
      "projectIds": [0],
      "stages": [
        {
          "id": 0,
          "meta": {},
          "type": "string"
        }
      ],
      "lockdown": {
        "id": 0,
        "meta": {},
        "type": "string"
      }
    }
  ],
  "meta": {
    "page": {
      "count": 0,
      "pageSize": 0,
      "pageOffset": 0,
      "hasMore": true
    },
    "limit": 0,
    "nextCursor": "string",
    "prevCursor": "string"
  },
  "included": {
    "projects": {},
    "stages": {},
    "users": {},
    "teams": {},
    "companies": {}
  }
}
```

### 400 Bad Request

Returns an ErrorResponse object with validation errors.

## Workflow Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique workflow identifier |
| `name` | string | Workflow name |
| `status` | string | Current workflow status |
| `defaultWorkflow` | boolean | Whether this is the default workflow |
| `projectSpecific` | boolean | Whether workflow is project-specific |
| `createdAt` | string | Creation timestamp |
| `updatedAt` | string | Last modification timestamp |
| `createdBy` | integer | Creator user ID |
| `updatedBy` | integer | Last modifier user ID |
| `projectIds` | array[integer] | Associated project IDs |
| `stages` | array | Array of stage references |
| `lockdown` | object | Lockdown configuration |

## Example Request

```bash
curl -X GET "https://yoursite.teamwork.com/projects/api/v3/workflows.json?pageSize=10&include=stages,projects" \
  -H "Authorization: Basic YOUR_API_KEY"
```
