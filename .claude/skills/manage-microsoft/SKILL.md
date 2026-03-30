---
name: manage-microsoft
description: Query Microsoft 365 services (Outlook, Teams, SharePoint) for context and information. Use when searching emails, retrieving Teams messages, finding SharePoint files, or gathering comprehensive context about a topic across all Microsoft services.
---

<essential_principles>
## How This Skill Works

This skill uses the Microsoft 365 API client at `apps/microsoft_365_api_client/` to interact with Microsoft Graph API. All operations use TypeScript with Bun runtime.

### 1. Client Initialization

Always import from the client index and create a client instance:

```typescript
import { createMicrosoftClient, createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

// From environment variables (recommended)
const client = createMicrosoftClientFromEnv();

// Or with explicit config
const client = createMicrosoftClient({
  tenantId: process.env.MICROSOFT_TENANT_ID!,
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
});
```

### 2. Environment Variables Required

```bash
MICROSOFT_TENANT_ID=<azure-tenant-id>
MICROSOFT_CLIENT_ID=<app-client-id>
MICROSOFT_CLIENT_SECRET=<app-secret>
# OR for delegated auth:
MICROSOFT_ACCESS_TOKEN=<user-token>
```

### 3. Available Resources

The client provides three main resources:
- `client.outlook` - Email and calendar operations
- `client.teams` - Teams, channels, chats, and messages
- `client.sharepoint` - OneDrive and SharePoint files and sites
- `client.collator` - Cross-service context gathering

### 4. Error Handling Pattern

All API calls should be wrapped in try-catch:

```typescript
try {
  const result = await client.outlook.searchMessages('project update');
  console.log('Found:', result.value.length, 'messages');
} catch (error) {
  if (error instanceof Error) {
    console.error('Failed:', error.message);
  }
  throw error;
}
```

### 5. Common Permissions Required

For full functionality, the Azure app registration needs these Microsoft Graph permissions:
- `Mail.Read`, `Mail.Send` - Outlook email
- `Calendars.Read`, `Calendars.ReadWrite` - Calendar
- `Team.ReadBasic.All`, `Channel.ReadBasic.All` - Teams
- `Chat.Read`, `ChannelMessage.Read.All` - Teams messages
- `Files.Read.All`, `Sites.Read.All` - SharePoint/OneDrive
</essential_principles>

<intake>
What would you like to do with Microsoft 365?

1. **Search emails** - Find relevant emails by keyword, sender, or date
2. **Send email** - Compose and send an email
3. **Get Teams messages** - Retrieve recent channel or chat messages
4. **Search SharePoint** - Find documents across SharePoint/OneDrive
5. **List calendar events** - View upcoming meetings and events
6. **Gather context** - Collate information from ALL sources for a topic

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Next Action |
|----------|-------------|
| 1, "email", "outlook", "search mail", "find email" | `workflows/search-emails.md` |
| 2, "send", "compose", "write email" | `workflows/send-email.md` |
| 3, "teams", "chat", "channel", "messages" | `workflows/get-teams-messages.md` |
| 4, "sharepoint", "files", "documents", "onedrive" | `workflows/search-sharepoint.md` |
| 5, "calendar", "meetings", "events", "schedule" | `workflows/list-events.md` |
| 6, "context", "gather", "collate", "all", "everything" | `workflows/collate-context.md` |

**After reading the workflow, follow it exactly.**
</routing>

<reference_index>
All domain knowledge in `references/`:

**API Client:** api-client.md (client setup, authentication, resources)
**Outlook Operations:** outlook-operations.md (email, calendar, attachments)
**Teams Operations:** teams-operations.md (teams, channels, chats, messages)
**SharePoint Operations:** sharepoint-operations.md (files, sites, search)
</reference_index>

<workflows_index>
| Workflow | Purpose |
|----------|---------|
| search-emails.md | Search and filter emails by keyword, sender, or date |
| send-email.md | Compose and send emails with attachments |
| get-teams-messages.md | Retrieve messages from Teams channels or chats |
| search-sharepoint.md | Search files across OneDrive and SharePoint |
| list-events.md | View calendar events and meetings |
| collate-context.md | Gather context from ALL services for a topic |
</workflows_index>

<quick_reference>
## Common Operations

**Search emails:**
```typescript
const messages = await client.outlook.searchMessages('quarterly report');
console.log(`Found ${messages.value.length} emails`);
for (const msg of messages.value) {
  console.log(`- ${msg.subject} from ${msg.from?.emailAddress?.address}`);
}
```

**List Teams messages:**
```typescript
const teams = await client.teams.listJoinedTeams();
const team = teams.value[0];
const channels = await client.teams.listChannels(team.id);
const messages = await client.teams.listChannelMessages(team.id, channels.value[0].id);
```

**Search files:**
```typescript
const files = await client.sharepoint.searchFiles('budget 2024');
for (const file of files.value) {
  console.log(`- ${file.name} at ${file.webUrl}`);
}
```

**Gather full context:**
```typescript
const context = await client.collator.collateContext('Project Alpha');
console.log(client.collator.formatAsMarkdown(context));
```
</quick_reference>

<success_criteria>
Skill workflow is complete when:
- [ ] Correct API method identified for the operation
- [ ] Required parameters gathered (query, team ID, etc.)
- [ ] TypeScript code executed successfully
- [ ] Results displayed or action confirmed
</success_criteria>
