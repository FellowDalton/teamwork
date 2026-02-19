# Search Emails Workflow

## Intake Questions

1. **What are you looking for?** (keywords, topic, or phrase)
2. **Any specific sender?** (email address or name)
3. **Time range?** (today, this week, last month, specific dates)
4. **Include unread only?**

## Steps

### 1. Gather Search Parameters

```typescript
const searchQuery = '<user-provided-keywords>';
const sender = '<optional-sender>'; // e.g., 'boss@company.com'
const daysBack = <number>; // e.g., 7 for last week
const unreadOnly = <boolean>;
```

### 2. Build and Execute Search

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

// Option A: KQL Search (best for keyword search)
const results = await client.outlook.searchMessages(searchQuery, { top: 25 });

// Option B: OData Filter (best for structured queries)
const filters: string[] = [];
if (sender) {
  filters.push(`from/emailAddress/address eq '${sender}'`);
}
if (daysBack) {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  filters.push(`receivedDateTime ge ${cutoff}`);
}
if (unreadOnly) {
  filters.push('isRead eq false');
}

const messages = await client.outlook.listMessages({
  filter: filters.length > 0 ? filters.join(' and ') : undefined,
  search: searchQuery,
  top: 25,
  orderBy: 'receivedDateTime desc',
});
```

### 3. Display Results

```typescript
console.log(`Found ${messages.value.length} emails:\n`);

for (const msg of messages.value) {
  console.log(`📧 ${msg.subject || '(No subject)'}`);
  console.log(`   From: ${msg.from?.emailAddress?.address}`);
  console.log(`   Date: ${msg.receivedDateTime}`);
  console.log(`   Read: ${msg.isRead ? 'Yes' : 'No'}`);
  if (msg.bodyPreview) {
    console.log(`   Preview: ${msg.bodyPreview.substring(0, 100)}...`);
  }
  if (msg.webLink) {
    console.log(`   Open: ${msg.webLink}`);
  }
  console.log('');
}
```

## Common Search Queries

### By Sender
```typescript
await client.outlook.listMessages({
  filter: "from/emailAddress/address eq 'user@company.com'",
});
```

### By Subject
```typescript
await client.outlook.searchMessages('subject:quarterly report');
```

### Unread Only
```typescript
await client.outlook.listMessages({
  filter: 'isRead eq false',
});
```

### With Attachments
```typescript
await client.outlook.listMessages({
  filter: 'hasAttachments eq true',
});
```

### From Today
```typescript
const today = new Date().toISOString().split('T')[0];
await client.outlook.listMessages({
  filter: `receivedDateTime ge ${today}T00:00:00Z`,
});
```

## Success Criteria

- [ ] Search query gathered from user
- [ ] Results retrieved from Outlook
- [ ] Results displayed with subject, sender, date, and preview
- [ ] Links provided for opening in Outlook
