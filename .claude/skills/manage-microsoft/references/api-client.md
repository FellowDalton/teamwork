# Microsoft 365 API Client Reference

## Overview

The Microsoft 365 API client provides TypeScript access to Microsoft Graph API for:
- **Outlook**: Email and calendar
- **Teams**: Teams, channels, chats, messages
- **SharePoint/OneDrive**: Files and sites

## Client Setup

### From Environment Variables (Recommended)

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();
```

### Required Environment Variables

```bash
MICROSOFT_TENANT_ID=<azure-tenant-id>
MICROSOFT_CLIENT_ID=<app-client-id>
MICROSOFT_CLIENT_SECRET=<app-secret>
```

### Optional Environment Variables

```bash
MICROSOFT_ACCESS_TOKEN=<user-token>  # For delegated auth (instead of client secret)
MICROSOFT_USE_BETA=true              # Use beta API instead of v1.0
```

### Explicit Configuration

```typescript
import { createMicrosoftClient } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClient({
  tenantId: 'your-tenant-id',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  debug: true,       // Enable logging
  useBeta: false,    // Use v1.0 API
  maxRetries: 3,     // Retry attempts
  retryDelayMs: 1000 // Base retry delay
});
```

## Client Resources

The client provides these resources:

| Resource | Purpose | Common Methods |
|----------|---------|----------------|
| `client.outlook` | Email & Calendar | `listMessages`, `searchMessages`, `sendMail`, `listEvents` |
| `client.teams` | Teams & Messaging | `listJoinedTeams`, `listChannelMessages`, `sendChannelMessage` |
| `client.sharepoint` | Files & Sites | `searchFiles`, `getMyDrive`, `listSiteDrives` |
| `client.collator` | Cross-Service | `collateContext`, `formatAsMarkdown` |
| `client.http` | Raw HTTP | `get`, `post`, `patch`, `delete` |

## Authentication Flows

### Client Credentials (App-Only)

Used for background services/daemons. Requires admin consent.

```typescript
const client = createMicrosoftClient({
  tenantId: 'xxx',
  clientId: 'xxx',
  clientSecret: 'xxx',
});
```

### Delegated (User Token)

Used when acting on behalf of a signed-in user.

```typescript
const client = createMicrosoftClient({
  tenantId: 'xxx',
  clientId: 'xxx',
  accessToken: 'user-access-token', // Obtained via OAuth flow
});
```

## Rate Limits

Microsoft Graph enforces these limits:
- **General**: 130,000 requests per 10 seconds per app
- **Mailbox**: 10,000 requests per 10 minutes per mailbox
- **Teams**: 30 requests per second per app per tenant

The client handles rate limiting automatically with exponential backoff.

## Error Handling

```typescript
import type { ApiError } from './apps/microsoft_365_api_client/src/index.ts';

try {
  const messages = await client.outlook.searchMessages('test');
} catch (error) {
  if ((error as ApiError).status === 401) {
    console.error('Authentication failed - check credentials');
  } else if ((error as ApiError).status === 403) {
    console.error('Permission denied - check API permissions');
  } else if ((error as ApiError).status === 429) {
    console.error('Rate limited - will retry automatically');
  }
}
```

## Common Patterns

### Pagination

The client handles OData pagination:

```typescript
// Get all pages automatically
const allMessages = await client.http.getAllPages<Message>('/me/messages');

// Or handle pagination manually
let messages = await client.outlook.listMessages({ top: 50 });
while (messages['@odata.nextLink']) {
  // Process messages.value
  messages = await client.http.get(messages['@odata.nextLink']);
}
```

### Filtering with OData

```typescript
// Filter emails from specific sender
const messages = await client.outlook.listMessages({
  filter: "from/emailAddress/address eq 'boss@company.com'",
  top: 10,
});

// Filter unread emails
const unread = await client.outlook.listMessages({
  filter: 'isRead eq false',
});

// Filter by date
const recent = await client.outlook.listMessages({
  filter: "receivedDateTime ge 2024-01-01T00:00:00Z",
});
```

### Selecting Fields

```typescript
// Only get specific fields (reduces response size)
const messages = await client.outlook.listMessages({
  select: 'id,subject,from,receivedDateTime',
});
```
