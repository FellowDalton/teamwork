# Teamwork Workflows API Documentation

This folder contains documentation for the Teamwork Workflows API v3 endpoints.

## Endpoints

### Workflows

| Method | Endpoint | Description | File |
|--------|----------|-------------|------|
| GET | `/projects/api/v3/workflows.json` | Get all workflows | [get-workflows.md](./get-workflows.md) |
| POST | `/projects/api/v3/workflows.json` | Create a new workflow | [create-workflow.md](./create-workflow.md) |

### Workflow Stages

| Method | Endpoint | Description | File |
|--------|----------|-------------|------|
| GET | `/projects/api/v3/workflows/{workflowId}/stages.json` | Get all stages for a workflow | [get-stages.md](./get-stages.md) |
| POST | `/projects/api/v3/workflows/{workflowId}/stages.json` | Create a new stage | [create-stage.md](./create-stage.md) |
| GET | `/projects/api/v3/workflows/{workflowId}/stages/{stageId}.json` | Get a specific stage | [get-stage.md](./get-stage.md) |
| PATCH | `/projects/api/v3/workflows/{workflowId}/stages/{stageId}.json` | Update an existing stage | [update-stage.md](./update-stage.md) |
| DELETE | `/projects/api/v3/workflows/{workflowId}/stages/{stageId}.json` | Delete an existing stage | [delete-stage.md](./delete-stage.md) |

### Stage Tasks

| Method | Endpoint | Description | File |
|--------|----------|-------------|------|
| GET | `/projects/api/v3/workflows/{workflowId}/stages/{stageId}/tasks` | Get tasks in a stage | [get-stage-tasks.md](./get-stage-tasks.md) |
| POST | `/projects/api/v3/workflows/{workflowId}/stages/{stageId}/tasks.json` | Add tasks to a stage | [add-tasks-to-stage.md](./add-tasks-to-stage.md) |
| GET | `/projects/api/v3/workflows/{workflowId}/backlog` | Get backlog tasks (unassigned to any stage) | [get-backlog.md](./get-backlog.md) |
| PATCH | `/projects/api/v3/tasks/{taskId}/workflows/{workflowId}.json` | Edit task position in stage | [edit-task-position.md](./edit-task-position.md) |

### Project Workflows

| Method | Endpoint | Description | File |
|--------|----------|-------------|------|
| POST | `/projects/api/v3/projects/{projectId}/workflows.json` | Apply workflow to a project | [apply-workflow-to-project.md](./apply-workflow-to-project.md) |
| POST | `/projects/api/v3/projects/workflows/{id}.json` | Apply workflow to multiple projects | [apply-workflow-to-projects.md](./apply-workflow-to-projects.md) |
| PATCH | `/projects/api/v3/projects/{projectId}/workflows/{id}.json` | Update a project workflow | [update-project-workflow.md](./update-project-workflow.md) |
| DELETE | `/projects/api/v3/projects/{projectId}/workflows/{id}.json` | Remove workflow from project | [remove-workflow-from-project.md](./remove-workflow-from-project.md) |

## API Base URL

```
https://{your-site}.teamwork.com/projects/api/v3/
```

## Authentication

All endpoints require API key authentication (Teamwork standard).

## Common Response Patterns

### Success Responses
- `200 OK` - Successful retrieval or update
- `201 Created` - Successfully created resource
- `204 No Content` - Successful deletion

### Error Responses
- `400 Bad Request` - Invalid request format or parameters
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Operation conflict

### Error Response Format
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

## Source

Documentation scraped from: https://apidocs.teamwork.com/docs/teamwork/endpoints-by-object/workflows/
