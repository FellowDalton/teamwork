# Workflow: Comment on Task

<required_reading>
**Read these reference files if needed:**
1. references/api-client.md (for client setup)
</required_reading>

<process>
## Step 1: Gather Information

**Required:**
- Task ID
- Comment content

**Optional:**
- Content type: `TEXT`, `HTML`, `MARKDOWN` (default: MARKDOWN)
- Private: boolean (default: false)

## Step 2: Post Simple Comment

```typescript
import { createTeamworkClient } from './apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// Simple text comment
const comment = await client.comments.postText(
  TASK_ID,
  'This is a plain text comment'
);
console.log(`Comment posted: ${comment.id}`);
```

## Step 3: Post Markdown Comment

```typescript
const comment = await client.comments.postMarkdown(TASK_ID, `
**Status Update**

- Completed the initial implementation
- Ready for review
- Next steps: Testing

\`\`\`
Code snippet here
\`\`\`
`);
```

## Step 4: Post Custom Comment

```typescript
const comment = await client.comments.createForTask(TASK_ID, {
  body: 'Comment content here',
  contentType: 'MARKDOWN',  // TEXT, HTML, or MARKDOWN
  isPrivate: false,
});
```

## Step 5: Post ADW Status Update (Formatted)

For automated workflow status updates:

```typescript
const comment = await client.comments.postAdwStatusUpdate(TASK_ID, {
  adwId: 'abc12345',
  status: 'In Progress',
  message: 'Starting automated processing...',
  // Optional:
  commitHash: 'abc123def',
  agentName: 'build-agent',
  errorMessage: undefined,  // for failures
});
```

This creates a formatted comment like:
```
🔄 **Status Update: In Progress**

- **ADW ID**: `abc12345`
- **Timestamp**: 2024-12-01T10:00:00.000Z

---

Starting automated processing...
```

## Step 6: List Existing Comments

```typescript
const response = await client.comments.listForTask(TASK_ID, {
  include: ['users'],
  pageSize: 20,
});

for (const comment of response.comments) {
  console.log(`[${comment.id}] ${comment.body.slice(0, 50)}...`);
}
```

## Step 7: Update or Delete Comment

```typescript
// Update
await client.comments.update(COMMENT_ID, 'Updated content', 'MARKDOWN');

// Delete
await client.comments.delete(COMMENT_ID);
```
</process>

<success_criteria>
This workflow is complete when:
- [ ] Task ID identified
- [ ] Comment content prepared
- [ ] Comment posted successfully
- [ ] Comment ID returned
</success_criteria>
