# List Calendar Events Workflow

## Intake Questions

1. **Time range?** (today, this week, next week, specific dates)
2. **Include past events?**
3. **Filter by keyword?** (optional subject filter)

## Steps

### 1. List Upcoming Events

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

// Get events for the next 7 days
const now = new Date();
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

const events = await client.outlook.listEvents({
  startDateTime: now.toISOString(),
  endDateTime: nextWeek.toISOString(),
  top: 50,
  orderBy: 'start/dateTime',
});

console.log(`Upcoming events (${events.value.length}):\n`);

for (const event of events.value) {
  const start = new Date(event.start?.dateTime || '');
  const end = new Date(event.end?.dateTime || '');

  console.log(`📅 ${event.subject || '(No subject)'}`);
  console.log(`   When: ${start.toLocaleString()} - ${end.toLocaleTimeString()}`);

  if (event.location?.displayName) {
    console.log(`   Where: ${event.location.displayName}`);
  }

  if (event.organizer?.emailAddress?.address) {
    console.log(`   Organizer: ${event.organizer.emailAddress.address}`);
  }

  if (event.isAllDay) {
    console.log(`   All day event`);
  }

  if (event.onlineMeeting?.joinUrl) {
    console.log(`   Teams: ${event.onlineMeeting.joinUrl}`);
  }

  if (event.attendees && event.attendees.length > 0) {
    const attendeeList = event.attendees
      .slice(0, 3)
      .map(a => a.emailAddress?.name || a.emailAddress?.address)
      .join(', ');
    const more = event.attendees.length > 3 ? ` +${event.attendees.length - 3} more` : '';
    console.log(`   Attendees: ${attendeeList}${more}`);
  }

  console.log('');
}
```

### 2. Get Today's Events

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

const todayEvents = await client.outlook.listEvents({
  startDateTime: today.toISOString(),
  endDateTime: tomorrow.toISOString(),
});

console.log(`Today's schedule (${todayEvents.value.length} events):\n`);

for (const event of todayEvents.value) {
  const start = new Date(event.start?.dateTime || '');
  console.log(`${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.subject}`);
}
```

### 3. Search Events by Subject

```typescript
const searchTerm = '<search-term>';

const events = await client.outlook.listEvents({
  startDateTime: new Date().toISOString(),
  endDateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  filter: `contains(subject, '${searchTerm}')`,
});

console.log(`Events matching "${searchTerm}":\n`);

for (const event of events.value) {
  console.log(`📅 ${event.subject}`);
  console.log(`   ${event.start?.dateTime}`);
  console.log('');
}
```

### 4. List Calendars

```typescript
const calendars = await client.outlook.listCalendars();

console.log('Your Calendars:\n');

for (const cal of calendars.value) {
  const defaultMark = cal.isDefaultCalendar ? ' (default)' : '';
  console.log(`📆 ${cal.name}${defaultMark}`);
  console.log(`   ID: ${cal.id}`);
  console.log('');
}

// Get events from a specific calendar
const calendarId = calendars.value[0].id;
const calEvents = await client.outlook.listEvents({
  calendarId,
  startDateTime: new Date().toISOString(),
  endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});
```

### 5. Get Event Details

```typescript
const eventId = '<event-id>';

const event = await client.outlook.getEvent(eventId);

console.log(`Event Details:\n`);
console.log(`Subject: ${event.subject}`);
console.log(`Start: ${event.start?.dateTime} (${event.start?.timeZone})`);
console.log(`End: ${event.end?.dateTime}`);
console.log(`Location: ${event.location?.displayName || 'No location'}`);
console.log(`Organizer: ${event.organizer?.emailAddress?.address}`);
console.log(`All Day: ${event.isAllDay}`);
console.log(`Cancelled: ${event.isCancelled}`);

if (event.body?.content) {
  console.log(`\nDescription:\n${event.body.content.replace(/<[^>]*>/g, '')}`);
}

if (event.attendees) {
  console.log(`\nAttendees:`);
  for (const attendee of event.attendees) {
    const status = attendee.status?.response || 'none';
    console.log(`  - ${attendee.emailAddress?.address} (${status})`);
  }
}
```

## Create a New Event

```typescript
const newEvent = await client.outlook.createEvent({
  subject: 'Team Meeting',
  body: 'Discuss Q4 planning',
  contentType: 'text',
  start: {
    dateTime: '2024-06-15T14:00:00',
    timeZone: 'America/New_York',
  },
  end: {
    dateTime: '2024-06-15T15:00:00',
    timeZone: 'America/New_York',
  },
  location: 'Conference Room A',
  attendees: ['user1@company.com', 'user2@company.com'],
  isOnlineMeeting: true, // Creates Teams meeting
});

console.log('✅ Event created!');
console.log(`Subject: ${newEvent.subject}`);
console.log(`Teams link: ${newEvent.onlineMeeting?.joinUrl}`);
```

## Success Criteria

- [ ] Time range specified by user
- [ ] Events retrieved from calendar
- [ ] Events displayed with time, subject, location
- [ ] Teams meeting links shown when available
