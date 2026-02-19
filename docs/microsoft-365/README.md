# Microsoft 365 Integration

This integration provides access to Microsoft 365 services through the Microsoft Graph API:

- **Outlook**: Email and calendar operations
- **Microsoft Teams**: Teams, channels, chats, and messages
- **SharePoint/OneDrive**: Files, sites, and document libraries

## Quick Start

### 1. Set Up Azure App Registration

See [Azure App Registration Guide](./setup/azure-app-registration.md) for detailed instructions.

### 2. Configure Environment Variables

```bash
# Required
MICROSOFT_TENANT_ID=<your-azure-tenant-id>
MICROSOFT_CLIENT_ID=<your-app-client-id>
MICROSOFT_CLIENT_SECRET=<your-client-secret>

# Optional
MICROSOFT_ACCESS_TOKEN=<user-token>  # For delegated auth (alternative to client secret)
MICROSOFT_USE_BETA=true              # Use beta API
```

### 3. Use the API Client

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

// Search emails
const emails = await client.outlook.searchMessages('quarterly report');

// Get Teams messages
const teams = await client.teams.listJoinedTeams();

// Search files
const files = await client.sharepoint.searchFiles('budget 2024');

// Gather context across all services
const context = await client.collator.collateContext('Project Alpha');
console.log(client.collator.formatAsMarkdown(context));
```

### 4. Use the Claude Skill

```
\manage-microsoft
```

This invokes the Microsoft 365 skill which provides guided workflows for:
- Searching emails
- Sending emails
- Getting Teams messages
- Searching SharePoint files
- Listing calendar events
- Collating context across all services

## Architecture

```
apps/microsoft_365_api_client/
├── src/
│   ├── index.ts           # Main exports, client factory
│   ├── auth.ts            # OAuth token management
│   ├── client.ts          # HTTP client with retry logic
│   ├── types.ts           # Zod schemas for type safety
│   ├── context-collator.ts # Cross-service context gathering
│   └── resources/
│       ├── outlook.ts     # Email & calendar
│       ├── teams.ts       # Teams, channels, chats
│       └── sharepoint.ts  # Files, sites
└── tests/

.claude/skills/manage-microsoft/
├── SKILL.md               # Skill definition
├── references/            # API documentation
└── workflows/             # Guided workflows
```

## Authentication Options

### Client Credentials (App-Only)

Best for background services and automation. Requires admin consent.

```typescript
const client = createMicrosoftClient({
  tenantId: 'xxx',
  clientId: 'xxx',
  clientSecret: 'xxx',
});
```

### Delegated (User Token)

Best for acting on behalf of a signed-in user.

```typescript
const client = createMicrosoftClient({
  tenantId: 'xxx',
  clientId: 'xxx',
  accessToken: 'user-oauth-token',
});
```

## Required Permissions

Minimum permissions for full functionality:

| Service | Permissions |
|---------|-------------|
| Outlook Mail | `Mail.Read`, `Mail.Send` |
| Calendar | `Calendars.Read`, `Calendars.ReadWrite` |
| Teams | `Team.ReadBasic.All`, `Channel.ReadBasic.All`, `Chat.Read` |
| Teams Messages | `ChannelMessage.Read.All` |
| SharePoint/OneDrive | `Files.Read.All`, `Sites.Read.All` |
| Search | `Files.Read.All` (for cross-service search) |

## Documentation

- [Azure App Registration](./setup/azure-app-registration.md)
- [Authentication Guide](./setup/authentication-flows.md)
- [Permissions Reference](./setup/permissions-guide.md)
- [API Reference](./api-reference/)
- [Examples](./examples/)

## Alternative Approaches

### Claude's Native Microsoft 365 Connector

If you have a Claude Team or Enterprise plan, you can use Claude's built-in Microsoft 365 connector:
- [Enable Microsoft 365 Connector](https://support.claude.com/en/articles/12542951-enabling-and-using-the-microsoft-365-connector)

### MCP Servers

Open-source MCP servers provide similar functionality:
- [Lokka](https://github.com/merill/lokka) - Full Graph + Azure RM
- [ms-365-mcp-server](https://github.com/Softeria/ms-365-mcp-server) - 90+ tools
- [office-365-mcp-server](https://github.com/hvkshetry/office-365-mcp-server) - 24 consolidated tools

### n8n Workflow Automation

n8n provides visual workflow automation with Microsoft 365 nodes:
- [n8n Microsoft Teams](https://n8n.io/integrations/microsoft-teams/)
- [n8n Microsoft Outlook](https://n8n.io/integrations/microsoft-outlook/)
