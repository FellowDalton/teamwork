# Get Teams Messages Workflow

## Intake Questions

1. **Which team?** (team name or list teams)
2. **Which channel?** (channel name or list channels)
3. **How many messages?** (default: 20)
4. **Search term?** (optional keyword filter)

## Steps

### 1. List Available Teams

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

const teams = await client.teams.listJoinedTeams();

console.log('Your Teams:\n');
for (let i = 0; i < teams.value.length; i++) {
  const team = teams.value[i];
  console.log(`${i + 1}. ${team.displayName}`);
  console.log(`   ID: ${team.id}`);
}
```

### 2. List Channels for Selected Team

```typescript
const teamId = '<selected-team-id>';

const channels = await client.teams.listChannels(teamId);

console.log('\nChannels:\n');
for (let i = 0; i < channels.value.length; i++) {
  const channel = channels.value[i];
  console.log(`${i + 1}. ${channel.displayName}`);
  console.log(`   ID: ${channel.id}`);
  console.log(`   Type: ${channel.membershipType}`);
}
```

### 3. Get Messages from Channel

```typescript
const teamId = '<team-id>';
const channelId = '<channel-id>';
const messageCount = 20;

const messages = await client.teams.listChannelMessages(teamId, channelId, {
  top: messageCount,
});

console.log(`\nRecent messages from channel:\n`);

for (const msg of messages.value) {
  const sender = msg.from?.user?.displayName || msg.from?.application?.displayName || 'Unknown';
  const time = new Date(msg.createdDateTime || '').toLocaleString();
  const content = msg.body?.content?.replace(/<[^>]*>/g, '') || ''; // Strip HTML

  console.log(`[${time}] ${sender}:`);
  console.log(`  ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);

  if (msg.attachments && msg.attachments.length > 0) {
    console.log(`  📎 ${msg.attachments.length} attachment(s)`);
  }

  console.log('');
}
```

### 4. Search Messages Across Teams

```typescript
const searchQuery = '<search-term>';

try {
  const results = await client.teams.searchMessages(searchQuery, 25);

  console.log(`\nSearch results for "${searchQuery}":\n`);

  for (const msg of results.value) {
    const sender = msg.from?.user?.displayName || 'Unknown';
    const content = msg.body?.content?.replace(/<[^>]*>/g, '') || '';

    console.log(`${sender}: ${content.substring(0, 150)}...`);
    if (msg.webUrl) {
      console.log(`  Open: ${msg.webUrl}`);
    }
    console.log('');
  }
} catch (error) {
  console.log('Note: Search API requires additional permissions');
}
```

## Get Chat Messages

```typescript
// List user's chats
const chats = await client.teams.listChats({ top: 20 });

console.log('Your Chats:\n');
for (const chat of chats.value) {
  console.log(`${chat.topic || 'Untitled'} (${chat.chatType})`);
  console.log(`  ID: ${chat.id}`);
}

// Get messages from a specific chat
const chatId = '<chat-id>';
const chatMessages = await client.teams.listChatMessages(chatId, { top: 20 });

for (const msg of chatMessages.value) {
  const sender = msg.from?.user?.displayName || 'Unknown';
  console.log(`${sender}: ${msg.body?.content}`);
}
```

## Get All Recent Activity

```typescript
async function getRecentTeamsActivity() {
  const teams = await client.teams.listJoinedTeams();
  const activity = [];

  for (const team of teams.value.slice(0, 5)) { // Top 5 teams
    const channels = await client.teams.listChannels(team.id);

    for (const channel of channels.value) {
      const messages = await client.teams.listChannelMessages(team.id, channel.id, {
        top: 5,
      });

      if (messages.value.length > 0) {
        activity.push({
          team: team.displayName,
          channel: channel.displayName,
          messages: messages.value.map(m => ({
            sender: m.from?.user?.displayName,
            content: m.body?.content?.replace(/<[^>]*>/g, '').substring(0, 100),
            time: m.createdDateTime,
          })),
        });
      }
    }
  }

  return activity;
}

const activity = await getRecentTeamsActivity();
console.log(JSON.stringify(activity, null, 2));
```

## Success Criteria

- [ ] Team selected (or listed for user to choose)
- [ ] Channel selected (or listed for user to choose)
- [ ] Messages retrieved and displayed
- [ ] Sender, timestamp, and content shown for each message
