# Outlook Operations Reference

## Email Operations

### List Messages

```typescript
const messages = await client.outlook.listMessages({
  folder: 'inbox',           // inbox, drafts, sentItems, deletedItems, or folder ID
  top: 50,                   // Max items (default: 50, max: 1000)
  skip: 0,                   // Pagination offset
  filter: 'isRead eq false', // OData filter
  search: 'quarterly',       // KQL search query
  orderBy: 'receivedDateTime desc', // Sort order
  includeBody: false,        // Include full body content
});

for (const msg of messages.value) {
  console.log(`${msg.subject} - ${msg.from?.emailAddress?.address}`);
}
```

### Search Messages

```typescript
// Search across all folders using KQL
const results = await client.outlook.searchMessages('from:boss@company.com subject:urgent');
```

**KQL Query Examples:**
- `from:john@example.com` - From specific sender
- `subject:meeting` - Subject contains "meeting"
- `hasattachment:true` - Has attachments
- `received:today` - Received today
- `received:this week` - Received this week
- `"exact phrase"` - Exact phrase match

### Get Single Message

```typescript
const message = await client.outlook.getMessage('messageId');
console.log(message.body?.content);
```

### Send Email

```typescript
await client.outlook.sendMail({
  subject: 'Project Update',
  body: '<h1>Status</h1><p>Everything is on track.</p>',
  contentType: 'html',       // 'html' or 'text'
  toRecipients: ['user1@company.com', 'user2@company.com'],
  ccRecipients: ['manager@company.com'],
  importance: 'high',        // 'low', 'normal', 'high'
  saveToSentItems: true,
});
```

### Reply to Email

```typescript
await client.outlook.replyToMessage('messageId', 'Thank you for the update!');
```

### Forward Email

```typescript
await client.outlook.forwardMessage(
  'messageId',
  ['recipient@company.com'],
  'FYI - please review'
);
```

### Mark as Read/Unread

```typescript
await client.outlook.updateMessageReadStatus('messageId', true);  // Mark read
await client.outlook.updateMessageReadStatus('messageId', false); // Mark unread
```

### Delete Message

```typescript
await client.outlook.deleteMessage('messageId'); // Moves to Deleted Items
```

### List Mail Folders

```typescript
const folders = await client.outlook.listMailFolders();
for (const folder of folders.value) {
  console.log(`${folder.displayName}: ${folder.unreadItemCount} unread`);
}
```

### Attachments

```typescript
// List attachments
const attachments = await client.outlook.listAttachments('messageId');

// Get specific attachment (includes content)
const attachment = await client.outlook.getAttachment('messageId', 'attachmentId');
console.log(attachment.contentBytes); // Base64 encoded
```

## Calendar Operations

### List Calendars

```typescript
const calendars = await client.outlook.listCalendars();
for (const cal of calendars.value) {
  console.log(`${cal.name} (default: ${cal.isDefaultCalendar})`);
}
```

### List Events

```typescript
const events = await client.outlook.listEvents({
  calendarId: 'calendar-id',  // Optional, defaults to primary
  startDateTime: '2024-01-01T00:00:00Z',
  endDateTime: '2024-12-31T23:59:59Z',
  top: 50,
  orderBy: 'start/dateTime',
});

for (const event of events.value) {
  console.log(`${event.subject} - ${event.start?.dateTime}`);
}
```

### Get Event Details

```typescript
const event = await client.outlook.getEvent('eventId');
console.log(event.body?.content);
console.log(event.onlineMeeting?.joinUrl);
```

### Create Event

```typescript
const event = await client.outlook.createEvent({
  subject: 'Team Standup',
  body: 'Daily sync meeting',
  contentType: 'text',
  start: {
    dateTime: '2024-06-15T09:00:00',
    timeZone: 'America/New_York',
  },
  end: {
    dateTime: '2024-06-15T09:30:00',
    timeZone: 'America/New_York',
  },
  location: 'Conference Room A',
  attendees: ['user1@company.com', 'user2@company.com'],
  isOnlineMeeting: true, // Creates Teams meeting
});

console.log('Teams join URL:', event.onlineMeeting?.joinUrl);
```

### Update Event

```typescript
await client.outlook.updateEvent('eventId', {
  subject: 'Updated: Team Standup',
  location: 'Conference Room B',
});
```

### Delete Event

```typescript
await client.outlook.deleteEvent('eventId');
```

### Respond to Meeting Invite

```typescript
// Accept
await client.outlook.acceptEvent('eventId', true, 'Looking forward to it!');

// Decline
await client.outlook.declineEvent('eventId', true, 'Schedule conflict');

// Tentative
await client.outlook.tentativelyAcceptEvent('eventId', true, 'Might be late');
```

## Common Filters

```typescript
// Unread emails
{ filter: 'isRead eq false' }

// From specific sender
{ filter: "from/emailAddress/address eq 'user@company.com'" }

// Contains subject text
{ filter: "contains(subject, 'urgent')" }

// Received after date
{ filter: "receivedDateTime ge 2024-01-01T00:00:00Z" }

// Has attachments
{ filter: 'hasAttachments eq true' }

// High importance
{ filter: "importance eq 'high'" }

// Combine filters
{ filter: "isRead eq false and importance eq 'high'" }
```
