# Customization Guide

This guide explains how to adapt the Chat Builder Template for your specific use case.

## Table of Contents

1. [Adding New Modes](#adding-new-modes)
2. [Modifying the Draft Structure](#modifying-the-draft-structure)
3. [Customizing the UI](#customizing-the-ui)
4. [Backend Customization](#backend-customization)
5. [Integrating External Services](#integrating-external-services)

---

## Adding New Modes

### 1. Define the Mode Type

In `frontend/src/types/conversation.ts`:

```typescript
export type ConversationMode = 'create' | 'query' | 'general' | 'your-mode';
```

### 2. Configure the Mode in App.tsx

```typescript
const MODES = [
  // ... existing modes
  {
    id: 'your-mode',
    label: 'YOUR MODE',
    icon: <YourIcon size={14} />,
    color: 'bg-green-600 hover:bg-green-500',
    welcomeMessage: 'Your mode is active. Describe what you want...',
  },
];
```

### 3. Add System Prompt in Backend

In `backend/server.ts`:

```typescript
const SYSTEM_PROMPTS: Record<string, string> = {
  // ... existing prompts
  'your-mode': `Your custom system prompt here.

  Guidelines:
  - What the AI should do
  - Output format expectations
  - Any special instructions`,
};
```

---

## Modifying the Draft Structure

### 1. Update Type Definitions

In `frontend/src/types/conversation.ts`:

```typescript
// Add custom fields to DraftItem
export interface DraftItem {
  id: string;
  name: string;
  description?: string;
  children?: DraftItem[];
  // Add your custom fields:
  priority?: 'low' | 'medium' | 'high';
  estimatedTime?: number;
  tags?: string[];
}

// Add custom summary fields
export interface DraftData {
  // ... existing fields
  summary: {
    totalSections: number;
    totalItems: number;
    totalSubItems: number;
    // Add custom metrics:
    totalEstimatedHours?: number;
    highPriorityCount?: number;
  };
}
```

### 2. Update DraftCard Component

In `frontend/src/components/DraftCard.tsx`:

```typescript
// Display custom fields in ItemRow
const ItemRow = ({ item, ... }) => {
  return (
    <div className="...">
      <span>{item.name}</span>

      {/* Add custom field displays */}
      {item.priority && (
        <span className={`badge badge-${item.priority}`}>
          {item.priority}
        </span>
      )}

      {item.estimatedTime && (
        <span className="text-xs text-zinc-500">
          {item.estimatedTime}h
        </span>
      )}
    </div>
  );
};
```

### 3. Update Backend JSON Lines Format

In `backend/server.ts`, update the system prompt:

```typescript
'your-mode': `Output JSON Lines with this format:

{"type":"item","id":"i1","sectionId":"s1","name":"Item","priority":"high","estimatedTime":2}

Include priority and estimatedTime for each item.`
```

---

## Customizing the UI

### Colors and Theming

Edit `frontend/tailwind.config.js` to add custom colors:

```javascript
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        },
      },
    },
  },
};
```

### Layout Changes

The main layout is in `App.tsx`. To change panel proportions:

```tsx
{/* Equal width panels (default) */}
<div className="flex-1 min-w-0 h-full">
  <ConversationPanel ... />
</div>
<div className="flex-1 min-w-0 h-full">
  <DataDisplayPanel ... />
</div>

{/* 40/60 split */}
<div className="w-2/5 min-w-0 h-full">
  <ConversationPanel ... />
</div>
<div className="w-3/5 min-w-0 h-full">
  <DataDisplayPanel ... />
</div>
```

### Component Styling

Each component uses Tailwind classes. Modify directly or extract to CSS:

```css
/* frontend/src/index.css */
.panel {
  @apply flex-1 flex flex-col h-full rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-800/50;
}
```

---

## Backend Customization

### Adding New Endpoints

In `backend/server.ts`:

```typescript
// Add a new route
if (url.pathname === '/api/your-endpoint' && req.method === 'POST') {
  return handleYourEndpoint(req);
}

async function handleYourEndpoint(req: Request): Promise<Response> {
  const body = await req.json();

  // Your logic here

  return Response.json({ success: true, data: result });
}
```

### Using Different Claude Models

```typescript
const response = await client.messages.create({
  model: 'claude-opus-4-20250514',  // or 'claude-sonnet-4-20250514'
  max_tokens: 8192,
  // ...
});
```

### Adding Tools (Function Calling)

```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  tools: [
    {
      name: 'search_database',
      description: 'Search the database for items',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      },
    },
  ],
  messages,
});

// Handle tool calls in the response
for await (const event of response) {
  if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
    const toolCall = event.content_block;
    // Execute the tool and send result back
  }
}
```

---

## Integrating External Services

### Database Integration

```typescript
// backend/server.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function handleSubmit(req: Request): Promise<Response> {
  const body = await req.json();

  // Save to database
  const { data, error } = await supabase
    .from('drafts')
    .insert({
      name: body.name,
      sections: body.sections,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return Response.json({
    success: true,
    id: data.id,
    url: `/drafts/${data.id}`,
    message: 'Saved successfully!',
  });
}
```

### Authentication

```typescript
// backend/server.ts
async function validateAuth(req: Request): Promise<boolean> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return false;

  // Validate token with your auth provider
  // ...

  return true;
}

// In route handler
if (url.pathname === '/api/stream' && req.method === 'POST') {
  if (!await validateAuth(req)) {
    return new Response('Unauthorized', { status: 401 });
  }
  return handleStream(req);
}
```

### Webhooks

```typescript
async function handleSubmit(req: Request): Promise<Response> {
  const body = await req.json();

  // Send webhook notification
  await fetch('https://your-webhook-url.com/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'draft_submitted',
      data: body,
      timestamp: new Date().toISOString(),
    }),
  });

  return Response.json({ success: true });
}
```

---

## Advanced: Progressive Rendering with MCP

For more complex use cases, you can use the Model Context Protocol (MCP) for tool-based progressive rendering:

```typescript
// Define MCP tools
const tools = [
  {
    name: 'init_draft',
    description: 'Initialize a new draft',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_section',
    description: 'Add a section to the draft',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
  },
  // ... more tools
];

// Handle tool calls and emit SSE events
```

This approach gives Claude explicit tools to call, making the structure more reliable than JSON Lines parsing.
