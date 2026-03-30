# Collate Context Workflow

## Purpose

Gather comprehensive context from ALL Microsoft 365 services for a topic, project, or query. This is useful when starting a new project or needing a complete picture of available information.

## Intake Questions

1. **What topic/project do you need context for?**
2. **How many results per service?** (default: 10)
3. **Include calendar events?** (default: yes)

## Steps

### 1. Use Built-in Collator

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

const topic = '<user-provided-topic>';

// Gather context from all services
const context = await client.collator.collateContext(topic, {
  maxEmails: 10,
  maxTeamsMessages: 10,
  maxFiles: 10,
  maxEvents: 5,
  eventDaysRange: 30,
  includeBodyPreviews: true,
});

// Display as formatted markdown
const markdown = client.collator.formatAsMarkdown(context);
console.log(markdown);
```

### 2. Custom Context Gathering

```typescript
const topic = '<topic>';

console.log(`\n📊 Gathering context for: ${topic}\n`);
console.log('='.repeat(50));

// Search emails
console.log('\n📧 EMAILS\n');
try {
  const emails = await client.outlook.searchMessages(topic, { top: 10 });
  console.log(`Found ${emails.value.length} relevant emails:\n`);

  for (const email of emails.value) {
    console.log(`• ${email.subject}`);
    console.log(`  From: ${email.from?.emailAddress?.address}`);
    console.log(`  Date: ${email.receivedDateTime}`);
    console.log(`  Preview: ${email.bodyPreview?.substring(0, 100)}...`);
    console.log('');
  }
} catch (e) {
  console.log('Could not search emails');
}

// Search Teams
console.log('\n💬 TEAMS MESSAGES\n');
try {
  const messages = await client.teams.searchMessages(topic, 10);
  console.log(`Found ${messages.value.length} relevant messages:\n`);

  for (const msg of messages.value) {
    const sender = msg.from?.user?.displayName || 'Unknown';
    const content = msg.body?.content?.replace(/<[^>]*>/g, '') || '';
    console.log(`• ${sender}:`);
    console.log(`  ${content.substring(0, 150)}...`);
    console.log('');
  }
} catch (e) {
  console.log('Could not search Teams (may require Search.Read permission)');
}

// Search files
console.log('\n📁 FILES\n');
try {
  const files = await client.sharepoint.searchFiles(topic, { top: 10 });
  console.log(`Found ${files.value.length} relevant files:\n`);

  for (const file of files.value) {
    console.log(`• ${file.name}`);
    console.log(`  Path: ${file.parentReference?.path}`);
    console.log(`  Modified: ${file.lastModifiedDateTime}`);
    console.log(`  URL: ${file.webUrl}`);
    console.log('');
  }
} catch (e) {
  console.log('Could not search files');
}

// Search calendar
console.log('\n📅 CALENDAR EVENTS\n');
try {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const events = await client.outlook.listEvents({
    startDateTime: now.toISOString(),
    endDateTime: futureDate.toISOString(),
    filter: `contains(subject, '${topic}')`,
    top: 5,
  });

  console.log(`Found ${events.value.length} related events:\n`);

  for (const event of events.value) {
    console.log(`• ${event.subject}`);
    console.log(`  When: ${event.start?.dateTime}`);
    if (event.location?.displayName) {
      console.log(`  Where: ${event.location.displayName}`);
    }
    console.log('');
  }
} catch (e) {
  console.log('Could not search calendar');
}

console.log('\n' + '='.repeat(50));
console.log('Context gathering complete!');
```

### 3. Export Context as JSON

```typescript
const topic = '<topic>';

const context = await client.collator.collateContext(topic);

// Export as JSON for further processing
const jsonOutput = JSON.stringify(context, null, 2);
console.log(jsonOutput);

// Or save to a file
await Bun.write(`context-${topic.replace(/\s+/g, '-')}.json`, jsonOutput);
```

### 4. Context Summary

```typescript
const topic = '<topic>';

const context = await client.collator.collateContext(topic);

console.log(`\n📊 Context Summary for "${context.topic}"\n`);
console.log(`Gathered at: ${context.gatheredAt}\n`);

console.log('Information found:');
console.log(`  • ${context.summary.emailCount} relevant emails`);
console.log(`  • ${context.summary.teamsMessageCount} Teams messages`);
console.log(`  • ${context.summary.fileCount} related files`);
console.log(`  • ${context.summary.eventCount} calendar events`);

const total =
  context.summary.emailCount +
  context.summary.teamsMessageCount +
  context.summary.fileCount +
  context.summary.eventCount;

console.log(`\nTotal items: ${total}`);

if (total === 0) {
  console.log('\n⚠️ No information found for this topic.');
  console.log('Try a different search term or check permissions.');
}
```

## Use Cases

### New Project Research
```typescript
const context = await client.collator.collateContext('Project Alpha');
// Shows all emails, messages, files, and meetings about Project Alpha
```

### Client Context
```typescript
const context = await client.collator.collateContext('Acme Corp');
// Shows all communications and files related to Acme Corp
```

### Meeting Preparation
```typescript
const context = await client.collator.collateContext('quarterly review');
// Shows relevant background for upcoming quarterly review
```

## Success Criteria

- [ ] Topic/query gathered from user
- [ ] Emails searched and summarized
- [ ] Teams messages searched and summarized
- [ ] Files searched and listed
- [ ] Calendar events filtered and listed
- [ ] Comprehensive summary displayed
