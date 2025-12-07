# Microsoft Graph API Permissions Guide

This guide explains the permission model and helps you choose the right permissions for your use case.

## Permission Types

### Delegated Permissions

- Used when app acts on behalf of a signed-in user
- Effective permissions = User's permissions ∩ App's permissions
- Some permissions require admin consent, others can be user-consented

### Application Permissions

- Used when app acts without a signed-in user (background services)
- Always require admin consent
- App has full access to all resources of that type

## Permission Reference by Service

### Outlook Mail

| Permission | Type | Description | Admin Consent |
|------------|------|-------------|---------------|
| `Mail.Read` | Delegated | Read user's mail | No |
| `Mail.Read` | Application | Read all mailboxes | Yes |
| `Mail.ReadBasic` | Delegated | Read basic mail props | No |
| `Mail.ReadWrite` | Delegated | Read/write user's mail | No |
| `Mail.Send` | Delegated | Send mail as user | No |
| `Mail.Send` | Application | Send as any user | Yes |

### Calendar

| Permission | Type | Description | Admin Consent |
|------------|------|-------------|---------------|
| `Calendars.Read` | Delegated | Read user's calendar | No |
| `Calendars.Read` | Application | Read all calendars | Yes |
| `Calendars.ReadWrite` | Delegated | Full access to user's calendar | No |
| `Calendars.Read.Shared` | Delegated | Read shared calendars | No |

### Microsoft Teams

| Permission | Type | Description | Admin Consent |
|------------|------|-------------|---------------|
| `Team.ReadBasic.All` | Delegated | Read user's teams | No |
| `Team.ReadBasic.All` | Application | Read all teams | Yes |
| `Channel.ReadBasic.All` | Delegated | Read channels | No |
| `Chat.Read` | Delegated | Read user's chats | No |
| `Chat.ReadWrite` | Delegated | Read/write chats | No |
| `ChannelMessage.Read.All` | Application | Read all channel messages | Yes |
| `ChatMessage.Read.All` | Application | Read all chat messages | Yes |

### SharePoint / OneDrive

| Permission | Type | Description | Admin Consent |
|------------|------|-------------|---------------|
| `Files.Read` | Delegated | Read user's files | No |
| `Files.Read.All` | Delegated | Read all accessible files | No |
| `Files.Read.All` | Application | Read all files | Yes |
| `Files.ReadWrite.All` | Delegated | Full file access | No |
| `Sites.Read.All` | Delegated | Read SharePoint sites | No |
| `Sites.Read.All` | Application | Read all sites | Yes |
| `Sites.ReadWrite.All` | Delegated | Full site access | Yes |

### Search

| Permission | Type | Description | Admin Consent |
|------------|------|-------------|---------------|
| `Files.Read.All` | Both | Required for search | Varies |

### User Profile

| Permission | Type | Description | Admin Consent |
|------------|------|-------------|---------------|
| `User.Read` | Delegated | Read own profile | No |
| `User.Read.All` | Delegated | Read all users | Yes |
| `User.Read.All` | Application | Read all users | Yes |

## Recommended Permission Sets

### Minimal Read-Only Access

For viewing emails, files, and Teams without modification:

**Delegated:**
- `User.Read`
- `Mail.Read`
- `Calendars.Read`
- `Files.Read.All`
- `Team.ReadBasic.All`
- `Chat.Read`

**Application:**
- `Mail.Read`
- `Calendars.Read`
- `Files.Read.All`
- `Team.ReadBasic.All`

### Full Context Gathering

For the context collator to work across all services:

**Delegated:**
- `User.Read`
- `Mail.Read`
- `Calendars.Read`
- `Files.Read.All`
- `Sites.Read.All`
- `Team.ReadBasic.All`
- `Channel.ReadBasic.All`
- `Chat.Read`
- `ChannelMessage.Read.All`

### Email Automation

For automated email processing and sending:

**Application:**
- `Mail.Read`
- `Mail.Send`
- `User.Read.All` (to resolve user IDs)

### Calendar Management

For creating and managing events:

**Delegated:**
- `Calendars.ReadWrite`
- `User.Read`

### File Management

For file upload, download, and organization:

**Delegated:**
- `Files.ReadWrite.All`
- `Sites.ReadWrite.All`

## Requesting Permissions

### Incremental Consent (Delegated)

Apps can request additional permissions as needed:

```typescript
// Initial login with basic permissions
// User consents to User.Read, Mail.Read

// Later, when accessing files for first time
// Trigger additional consent for Files.Read.All
```

### Static Permissions (Application)

All permissions must be configured upfront in Azure portal and admin-consented.

## Best Practices

### 1. Principle of Least Privilege

Only request permissions you actually need:

```
❌ Files.ReadWrite.All (if you only read files)
✅ Files.Read.All
```

### 2. Prefer Delegated Over Application

When possible, use delegated permissions:
- Respects user's actual access
- Easier to audit
- Less admin overhead

### 3. Document Permission Usage

Keep a record of why each permission is needed:

```markdown
| Permission | Reason |
|------------|--------|
| Mail.Read | Search emails for context |
| Files.Read.All | Search SharePoint documents |
```

### 4. Handle Permission Errors Gracefully

```typescript
try {
  const emails = await client.outlook.searchMessages('test');
} catch (error) {
  if (error.status === 403) {
    console.log('Mail.Read permission required');
    // Trigger consent flow or show helpful message
  }
}
```

## Troubleshooting Permission Issues

### "Insufficient privileges to complete the operation"

1. Check if the required permission is configured in Azure
2. Verify admin consent was granted (for application permissions)
3. Check if the user has access to the resource

### "Request_UnsupportedQuery"

Some query parameters require specific permissions. Check the API documentation.

### "Access is denied" for Teams Messages

`ChannelMessage.Read.All` requires RSC (Resource-Specific Consent) in some cases.

## Rate Limits and Throttling

Permissions don't affect rate limits, but scope does:

| Scope | Limit |
|-------|-------|
| Per app (global) | 130,000 / 10 seconds |
| Per mailbox | 10,000 / 10 minutes |
| Per user (Teams) | 30 / second |

When throttled, the client automatically retries with exponential backoff.
