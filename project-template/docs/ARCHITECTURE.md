# Architecture Overview

This document explains the system design and data flow of the Chat Builder Template.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐          ┌───────────────────────────┐   │
│  │ ConversationPanel │          │    DataDisplayPanel       │   │
│  │                   │          │                           │   │
│  │  - Messages list  │          │  - DraftCard (building)   │   │
│  │  - Thinking status│          │  - Summary stats          │   │
│  │  - Input field    │          │  - Inline editing         │   │
│  └─────────┬─────────┘          └─────────────┬─────────────┘   │
│            │                                  │                  │
│            └──────────────┬───────────────────┘                  │
│                           │                                      │
│                    useStreamingChat                              │
│                           │                                      │
│                    streamingService                              │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │ SSE (Server-Sent Events)
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                           │                                      │
│                     Backend (Bun)                                │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────┐        │
│  │                   Route Handler                      │        │
│  │                                                      │        │
│  │  POST /api/stream  ──→  handleStream()               │        │
│  │  POST /api/submit  ──→  handleSubmit()               │        │
│  └──────────────────────────┬───────────────────────────┘        │
│                             │                                    │
│                      Claude API                                  │
│                    (Streaming)                                   │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Anthropic API   │
                    └───────────────────┘
```

## Component Responsibilities

### Frontend

| Component | Responsibility |
|-----------|---------------|
| `App.tsx` | Main application, mode management, layout |
| `ConversationPanel` | Chat UI, message display, input handling |
| `DataDisplayPanel` | Right panel, draft preview, submit actions |
| `DraftCard` | Progressive draft rendering, inline editing |
| `useStreamingChat` | State management, streaming coordination |
| `streamingService` | SSE connection, event parsing |

### Backend

| Module | Responsibility |
|--------|---------------|
| `server.ts` | HTTP server, routing, CORS |
| `handleStream` | SSE streaming, Claude API calls |
| `handleSubmit` | Draft submission, persistence |
| System prompts | Mode-specific AI instructions |

## Data Flow

### 1. Message Send Flow

```
User types message
       ↓
ConversationPanel.handleSend()
       ↓
useStreamingChat.sendMessage()
       ↓
streamingService.processStream()
       ↓
POST /api/stream { message, mode, history }
       ↓
Backend creates SSE stream
       ↓
Claude API streaming response
       ↓
Parse JSON Lines (create mode) or text
       ↓
Emit SSE events (draft_init, draft_update, etc.)
       ↓
Frontend receives via EventSource-like reader
       ↓
Update React state (messages, draft, thinking)
       ↓
UI re-renders progressively
```

### 2. Draft Building Flow

```
Claude outputs:
{"type":"draft","name":"Project Plan"}
       ↓
Backend parses, emits:
{ type: 'draft_init', draft: { ... } }
       ↓
Frontend receives:
onDraft(draft) → setDraft(draft)
       ↓
DraftCard renders with isBuilding=true
       ↓
Claude outputs:
{"type":"section","id":"s1","name":"Phase 1"}
       ↓
Backend emits:
{ type: 'draft_update', action: 'add_section', section: {...} }
       ↓
Frontend receives:
onDraftUpdate(update) → setDraft(prev => {...prev, sections: [..., section]})
       ↓
DraftCard.SectionCard renders with animation
       ↓
[Repeat for items, subitems]
       ↓
Claude outputs:
{"type":"complete","message":"Done!"}
       ↓
Backend emits:
{ type: 'draft_complete', message: 'Done!' }
       ↓
Frontend:
onDraftComplete() → setDraft(prev => {...prev, isBuilding: false})
       ↓
DraftCard shows complete state, Submit button appears
```

### 3. Submit Flow

```
User clicks Submit
       ↓
DataDisplayPanel.onDraftSubmit()
       ↓
useStreamingChat.submitCurrentDraft()
       ↓
streamingService.submitDraft(draft)
       ↓
POST /api/submit { id, name, sections, ... }
       ↓
Backend processes (save to DB, call external API, etc.)
       ↓
Response: { success, url, message }
       ↓
Frontend:
setDraft({ ...draft, isSubmitted: true, submittedUrl: url })
       ↓
Add success message to chat
       ↓
DraftCard shows submitted state with link
```

## State Management

### Main State (useStreamingChat)

```typescript
{
  messages: ChatMessage[];      // Conversation history
  inputValue: string;           // Current input
  isProcessing: boolean;        // Stream in progress
  thinkingStatus: string;       // Claude's reasoning
  draft: DraftData | null;      // Current draft being built
  isSubmitting: boolean;        // Submit in progress
}
```

### Draft State Structure

```typescript
{
  id: string;                   // Unique identifier
  name: string;                 // Draft title
  description?: string;         // Optional description
  sections: [                   // Hierarchical structure
    {
      id: string;
      name: string;
      items: [
        {
          id: string;
          name: string;
          children?: [...];     // Sub-items
        }
      ]
    }
  ];
  summary: {                    // Computed stats
    totalSections: number;
    totalItems: number;
    totalSubItems: number;
  };
  isBuilding: boolean;          // True during streaming
  isSubmitted: boolean;         // True after submit
  submittedUrl?: string;        // Link after submit
}
```

## SSE Event Protocol

### Event Types

| Event | Purpose | Payload |
|-------|---------|---------|
| `init` | Stream started | `{ model }` |
| `thinking` | Claude's reasoning | `{ thinking }` |
| `text` | Response text | `{ text }` |
| `draft_init` | Initialize draft | `{ draft }` |
| `draft_update` | Add section/item | `{ action, section?, item?, ... }` |
| `draft_complete` | Draft finished | `{ message? }` |
| `error` | Error occurred | `{ error }` |
| `[DONE]` | Stream ended | - |

### Event Format

```
data: {"type":"init","model":"claude-sonnet-4-20250514"}

data: {"type":"thinking","thinking":"Let me analyze..."}

data: {"type":"draft_init","draft":{...}}

data: {"type":"draft_update","action":"add_section","section":{...}}

data: [DONE]

```

## JSON Lines Format

For progressive content generation, Claude outputs JSON Lines:

```json
{"type":"draft","name":"My Project","description":"A great project"}
{"type":"section","id":"s1","name":"Planning","description":"Initial phase"}
{"type":"item","id":"i1","sectionId":"s1","name":"Research"}
{"type":"subitem","itemId":"i1","name":"Market analysis"}
{"type":"subitem","itemId":"i1","name":"Competitor review"}
{"type":"item","id":"i2","sectionId":"s1","name":"Requirements"}
{"type":"section","id":"s2","name":"Development"}
{"type":"item","id":"i3","sectionId":"s2","name":"Implementation"}
{"type":"complete","message":"Structure generated!"}
```

Benefits:
- Each line is independently parseable
- Progressive rendering as lines arrive
- Easy to extend with new types
- Human-readable for debugging

## Error Handling

### Frontend Errors

```typescript
onError: (error) => {
  console.error('Stream error:', error);

  // Add error message to chat
  const errorMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content: 'An error occurred.',
    ...
  };
  setMessages(prev => [...prev, errorMsg]);

  // Reset processing state
  setIsProcessing(false);
}
```

### Backend Errors

```typescript
try {
  // ... stream logic
} catch (error) {
  console.error('Stream error:', error);

  // Send error event
  enqueue(JSON.stringify({
    type: 'error',
    error: error.message
  }));

  // Close stream
  enqueue('[DONE]');
  controller.close();
}
```

## Performance Considerations

1. **Streaming vs Buffering**: SSE provides real-time updates without waiting for full response
2. **Progressive Rendering**: Draft sections appear as they're generated
3. **State Immutability**: React re-renders only changed components
4. **Auto-scroll**: Only scrolls when at bottom of container
5. **Debounced Edits**: Inline editing doesn't trigger re-renders on every keystroke
