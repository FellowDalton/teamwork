# Teams Operations Reference

## Teams Operations

### List Joined Teams

```typescript
const teams = await client.teams.listJoinedTeams();

for (const team of teams.value) {
  console.log(`${team.displayName} - ${team.description}`);
  console.log(`  ID: ${team.id}`);
  console.log(`  URL: ${team.webUrl}`);
}
```

### Get Team Details

```typescript
const team = await client.teams.getTeam('team-id');
console.log(team.displayName);
```

## Channel Operations

### List Channels

```typescript
const channels = await client.teams.listChannels('team-id');

for (const channel of channels.value) {
  console.log(`${channel.displayName} (${channel.membershipType})`);
  console.log(`  ID: ${channel.id}`);
  console.log(`  Email: ${channel.email}`);
}
```

### Get Primary Channel

```typescript
// Get the "General" channel
const general = await client.teams.getPrimaryChannel('team-id');
```

### Get Channel Details

```typescript
const channel = await client.teams.getChannel('team-id', 'channel-id');
```

### Create Channel

```typescript
const channel = await client.teams.createChannel(
  'team-id',
  'Project Alpha',      // Display name
  'Discussion channel', // Description
  'standard'            // 'standard', 'private', or 'shared'
);
```

### Delete Channel

```typescript
await client.teams.deleteChannel('team-id', 'channel-id');
```

## Channel Message Operations

### List Channel Messages

```typescript
const messages = await client.teams.listChannelMessages('team-id', 'channel-id', {
  top: 50,
});

for (const msg of messages.value) {
  console.log(`${msg.from?.user?.displayName}: ${msg.body?.content}`);
  console.log(`  Sent: ${msg.createdDateTime}`);
}
```

### Get Message Replies

```typescript
const replies = await client.teams.listMessageReplies(
  'team-id',
  'channel-id',
  'message-id'
);
```

### Send Channel Message

```typescript
const message = await client.teams.sendChannelMessage('team-id', 'channel-id', {
  content: '<p>Hello team! Here is the <b>weekly update</b>.</p>',
  contentType: 'html',
  importance: 'high',      // 'normal', 'high', 'urgent'
  subject: 'Weekly Update', // Optional subject line
});
```

### Reply to Channel Message

```typescript
await client.teams.replyToChannelMessage(
  'team-id',
  'channel-id',
  'message-id',
  {
    content: 'Thanks for the update!',
    contentType: 'text',
  }
);
```

## Chat Operations

### List Chats

```typescript
const chats = await client.teams.listChats({
  top: 50,
  expand: 'members', // Include member info
});

for (const chat of chats.value) {
  console.log(`${chat.topic || 'Untitled'} (${chat.chatType})`);
  console.log(`  Last updated: ${chat.lastUpdatedDateTime}`);
}
```

### Get Chat Details

```typescript
const chat = await client.teams.getChat('chat-id');
```

### List Chat Messages

```typescript
const messages = await client.teams.listChatMessages('chat-id', {
  top: 50,
});

for (const msg of messages.value) {
  console.log(`${msg.from?.user?.displayName}: ${msg.body?.content}`);
}
```

### Send Chat Message

```typescript
const message = await client.teams.sendChatMessage('chat-id', {
  content: 'Quick question about the project...',
  contentType: 'text',
});
```

## Search Operations

### Search Across Teams

```typescript
// Requires Search.Read permission
const results = await client.teams.searchMessages('budget proposal', 25);

for (const msg of results.value) {
  console.log(`${msg.from?.user?.displayName}: ${msg.body?.content?.substring(0, 100)}`);
}
```

## Meeting Operations

### Create Online Meeting

```typescript
const meeting = await client.teams.createOnlineMeeting({
  subject: 'Project Review',
  startDateTime: '2024-06-15T14:00:00Z',
  endDateTime: '2024-06-15T15:00:00Z',
  participants: ['user1@company.com', 'user2@company.com'],
});

console.log('Join URL:', meeting.joinWebUrl);
```

### Get Meeting Details

```typescript
const meeting = await client.teams.getOnlineMeeting('meeting-id');
```

## Common Patterns

### Get Messages from All Channels

```typescript
async function getAllTeamMessages(teamId: string, limit: number = 10) {
  const channels = await client.teams.listChannels(teamId);
  const allMessages = [];

  for (const channel of channels.value) {
    const messages = await client.teams.listChannelMessages(teamId, channel.id, {
      top: limit,
    });

    allMessages.push({
      channel: channel.displayName,
      messages: messages.value,
    });
  }

  return allMessages;
}
```

### Get Recent Activity Across Teams

```typescript
async function getRecentActivity(hoursAgo: number = 24) {
  const teams = await client.teams.listJoinedTeams();
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  const activity = [];

  for (const team of teams.value) {
    const channels = await client.teams.listChannels(team.id);

    for (const channel of channels.value) {
      const messages = await client.teams.listChannelMessages(team.id, channel.id, {
        top: 20,
      });

      const recent = messages.value.filter(m =>
        m.createdDateTime && m.createdDateTime > cutoff
      );

      if (recent.length > 0) {
        activity.push({
          team: team.displayName,
          channel: channel.displayName,
          messages: recent,
        });
      }
    }
  }

  return activity;
}
```

## Message Content Types

Teams messages support HTML content:

```typescript
// Plain text
{ content: 'Hello world', contentType: 'text' }

// HTML formatting
{
  content: '<p><b>Bold</b> and <i>italic</i></p>',
  contentType: 'html'
}

// Mentions (requires specific format)
{
  content: '<at id="0">John Doe</at>, please review',
  contentType: 'html',
  mentions: [{
    id: 0,
    mentionText: 'John Doe',
    mentioned: { user: { id: 'user-id', displayName: 'John Doe' }}
  }]
}
```
