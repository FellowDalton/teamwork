# Send Email Workflow

## Intake Questions

1. **Who are the recipients?** (To, CC, BCC email addresses)
2. **What is the subject?**
3. **What should the email say?**
4. **Priority level?** (normal, high)
5. **Format?** (plain text or HTML)

## Steps

### 1. Gather Email Details

```typescript
const emailDetails = {
  to: ['recipient1@company.com', 'recipient2@company.com'],
  cc: ['manager@company.com'], // optional
  bcc: [], // optional
  subject: '<user-provided-subject>',
  body: '<user-provided-body>',
  contentType: 'html' as const, // 'text' or 'html'
  importance: 'normal' as const, // 'low', 'normal', 'high'
};
```

### 2. Send the Email

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

await client.outlook.sendMail({
  subject: emailDetails.subject,
  body: emailDetails.body,
  contentType: emailDetails.contentType,
  toRecipients: emailDetails.to,
  ccRecipients: emailDetails.cc,
  bccRecipients: emailDetails.bcc,
  importance: emailDetails.importance,
  saveToSentItems: true,
});

console.log('✅ Email sent successfully!');
console.log(`To: ${emailDetails.to.join(', ')}`);
console.log(`Subject: ${emailDetails.subject}`);
```

## HTML Email Template

```typescript
const htmlBody = `
<!DOCTYPE html>
<html>
<body>
<h2>Subject Heading</h2>
<p>Dear Team,</p>
<p>Email content goes here.</p>
<ul>
  <li>Point 1</li>
  <li>Point 2</li>
</ul>
<p>Best regards,<br/>Your Name</p>
</body>
</html>
`;

await client.outlook.sendMail({
  subject: 'Important Update',
  body: htmlBody,
  contentType: 'html',
  toRecipients: ['team@company.com'],
});
```

## Reply to Existing Email

```typescript
// First, get the message ID
const messages = await client.outlook.searchMessages('original subject');
const originalMessage = messages.value[0];

// Reply
await client.outlook.replyToMessage(
  originalMessage.id,
  'Thank you for the update. I will review and get back to you.'
);

console.log('✅ Reply sent!');
```

## Forward an Email

```typescript
// Get the message to forward
const messages = await client.outlook.searchMessages('report to forward');
const message = messages.value[0];

// Forward it
await client.outlook.forwardMessage(
  message.id,
  ['colleague@company.com', 'team@company.com'],
  'FYI - Please review the attached report.'
);

console.log('✅ Email forwarded!');
```

## Error Handling

```typescript
try {
  await client.outlook.sendMail({
    subject: 'Test',
    body: 'Test body',
    toRecipients: ['user@company.com'],
  });
  console.log('✅ Email sent successfully!');
} catch (error) {
  if (error.status === 400) {
    console.error('❌ Invalid request - check email addresses');
  } else if (error.status === 403) {
    console.error('❌ Permission denied - Mail.Send permission required');
  } else {
    console.error('❌ Failed to send:', error.message);
  }
}
```

## Success Criteria

- [ ] Recipients validated
- [ ] Subject and body content prepared
- [ ] Email sent successfully
- [ ] Confirmation displayed
