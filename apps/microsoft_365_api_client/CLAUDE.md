# Microsoft 365 Integration

## Overview

This package provides TypeScript access to Microsoft Graph API for Outlook, Teams, and SharePoint/OneDrive. It follows the same patterns as the Teamwork API client.

## Quick Start

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

// Search emails
const emails = await client.outlook.searchMessages('project update');

// Get Teams messages
const teams = await client.teams.listJoinedTeams();

// Search files
const files = await client.sharepoint.searchFiles('quarterly report');

// Gather context from ALL services
const context = await client.collator.collateContext('Project Alpha');
```

## Environment Variables

```bash
MICROSOFT_TENANT_ID=<azure-tenant-id>
MICROSOFT_CLIENT_ID=<app-client-id>
MICROSOFT_CLIENT_SECRET=<app-secret>
```

## SharePoint Client Folders

When integrating with Teamwork projects, look for client data in SharePoint at these locations:

```
SharePoint Site / Document Library
├── Clients/
│   └── {ClientName}/
│       ├── Projects/
│       │   └── {ProjectName}/
│       │       ├── Documents/
│       │       ├── Contracts/
│       │       └── Deliverables/
│       ├── Contacts/
│       └── Agreements/
└── Shared Documents/
```

### Finding Client Folders

```typescript
// Search for client folder by name
const clientName = 'Acme Corp';
const folders = await client.sharepoint.searchFiles(clientName);

// Or browse a known structure
const clientFolder = await client.sharepoint.listItemsByPath(`Clients/${clientName}`);

// Get project-specific files
const projectFiles = await client.sharepoint.listItemsByPath(
  `Clients/${clientName}/Projects/${projectName}`
);
```

## Dataweb Integration

When a project is selected in the frontend, the dataweb configuration links it to:

1. **SharePoint folders** - Client documents, contracts, deliverables
2. **Outlook emails** - Relevant email threads and conversations
3. **Teams channels** - Project-related team discussions
4. **Calendar events** - Meetings associated with the project

See `specs/dataweb-integration-plan.md` for the full implementation plan.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Client factory, exports |
| `src/auth.ts` | OAuth token management |
| `src/client.ts` | HTTP client with retry logic |
| `src/types.ts` | Zod schemas for API responses |
| `src/resources/outlook.ts` | Email and calendar |
| `src/resources/teams.ts` | Teams, channels, chats |
| `src/resources/sharepoint.ts` | Files and sites |
| `src/context-collator.ts` | Cross-service context |

## Using the Skill

```
\manage-microsoft
```

This invokes the guided skill for Microsoft 365 operations.

## API Permissions Required

| Service | Permissions |
|---------|-------------|
| Outlook | `Mail.Read`, `Mail.Send`, `Calendars.Read` |
| Teams | `Team.ReadBasic.All`, `Channel.ReadBasic.All`, `Chat.Read` |
| SharePoint | `Files.Read.All`, `Sites.Read.All` |

## See Also

- `docs/microsoft-365/` - Full documentation
- `.claude/skills/manage-microsoft/` - Claude skill
- `specs/dataweb-integration-plan.md` - Dataweb feature spec
