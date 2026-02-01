# Chat Builder Template

A reusable template for building AI-powered chat applications with progressive data display. Features a split-panel interface with a chat conversation on the left and a dynamic data display on the right that builds in real-time as the AI generates content.

## Features

- **Split-panel layout**: Chat interface on the left, data display on the right
- **Progressive streaming**: Items appear in real-time as Claude generates them
- **Draft building**: Complex structures are built progressively with visual feedback
- **Inline editing**: Edit draft items before submission
- **Mode switching**: Different AI behaviors for different use cases
- **SSE communication**: Real-time backend → frontend updates

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Anthropic API key](https://console.anthropic.com/)

### Setup

1. **Install dependencies**

```bash
# Frontend
cd frontend
bun install

# Backend
cd ../backend
bun install
```

2. **Configure environment**

```bash
# In backend directory
export ANTHROPIC_API_KEY=your-api-key-here
```

3. **Start the servers**

```bash
# Terminal 1: Backend
cd backend
bun run dev

# Terminal 2: Frontend
cd frontend
bun run dev
```

4. **Open the app**

Navigate to `http://localhost:3000`

## Project Structure

```
project-template/
├── frontend/                  # Vite + React + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConversationPanel.tsx   # Chat interface
│   │   │   ├── DataDisplayPanel.tsx    # Right panel
│   │   │   └── DraftCard.tsx           # Progressive draft display
│   │   ├── hooks/
│   │   │   └── useStreamingChat.ts     # Chat state management
│   │   ├── services/
│   │   │   └── streamingService.ts     # SSE handling
│   │   ├── types/
│   │   │   ├── conversation.ts         # Chat & display types
│   │   │   └── streaming.ts            # SSE event types
│   │   └── App.tsx                     # Main application
│   └── ...config files
│
├── backend/                   # Bun server
│   └── server.ts              # SSE streaming & Claude API
│
└── docs/
    ├── CUSTOMIZATION.md       # How to adapt the template
    └── ARCHITECTURE.md        # System design details
```

## How It Works

### Data Flow

```
User Input
    ↓
Frontend sends message to /api/stream
    ↓
Backend streams SSE events:
  - thinking: Shows Claude's reasoning
  - draft_init: Initializes draft structure
  - draft_update: Adds sections/items progressively
  - draft_complete: Marks draft as ready
    ↓
Frontend updates UI in real-time
    ↓
User reviews and edits draft
    ↓
User clicks Submit
    ↓
Frontend sends to /api/submit
    ↓
Backend processes and returns result
```

### Modes

The template includes three modes (customize in `App.tsx`):

| Mode | Purpose | Behavior |
|------|---------|----------|
| CREATE | Generate structured content | Outputs JSON Lines for progressive building |
| QUERY | Answer questions | Standard chat responses |
| GENERAL | General chat | Basic conversation |

## Customization

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for detailed instructions on:

- Adding new modes
- Modifying the draft structure
- Changing the UI styling
- Integrating with external services
- Adding authentication

## Example Use Cases

This template can be adapted for:

- **Project Planning**: Generate project structures with phases/tasks
- **Content Creation**: Build outlines with sections/paragraphs
- **API Design**: Create endpoints with parameters
- **Recipe Builder**: Generate ingredients and steps
- **Meeting Notes**: Capture topics with action items

## License

MIT
