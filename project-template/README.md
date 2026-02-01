# Chat Builder Template

A reusable template for building AI-powered chat applications with progressive data display. Features a split-panel interface with a chat conversation on the left and a dynamic data display on the right that builds in real-time as the AI generates content.

## What It Does

**Default Example: Outline Builder**

```
You: "Create an outline for a blog post about learning to code"

AI progressively builds:
📄 Learning to Code: A Beginner's Guide
├── 📁 Getting Started
│   ├── Choosing Your First Language
│   │   ├── Python for beginners
│   │   └── JavaScript for web
│   └── Setting Up Your Environment
├── 📁 Learning Resources
│   ├── Online Courses
│   ├── Documentation & Tutorials
│   └── Practice Projects
└── 📁 Building Skills
    ├── Debugging Techniques
    └── Reading Others' Code
```

Items appear one-by-one in real-time as Claude generates them. You can edit any item before submitting.

## Customize It

This template is designed to be adapted for your use case:

| Example Use Case | What Gets Built |
|------------------|-----------------|
| **Project Planner** | Phases → Tasks → Subtasks (with estimates, priorities) |
| **Recipe Builder** | Sections → Steps → Tips (with times, ingredients) |
| **Course Creator** | Modules → Lessons → Topics (with duration) |
| **Meeting Agenda** | Topics → Discussion Points → Action Items |

**Two ways to customize:**

1. **Read the guide**: [docs/BUILDER_GUIDE.md](docs/BUILDER_GUIDE.md) - Step-by-step instructions
2. **Use the Builder Agent**: [docs/BUILDER_AGENT.md](docs/BUILDER_AGENT.md) - An interactive Claude prompt that asks questions and generates your customization code

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

## Documentation

| Document | Purpose |
|----------|---------|
| [BUILDER_GUIDE.md](docs/BUILDER_GUIDE.md) | Step-by-step customization walkthrough |
| [BUILDER_AGENT.md](docs/BUILDER_AGENT.md) | Interactive Claude prompt to generate your config |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and data flow details |
| [CUSTOMIZATION.md](docs/CUSTOMIZATION.md) | Quick reference for common changes |

## How Customization Works

1. **Define your schema** - What are you building? (project, recipe, course...)
2. **Update the system prompt** - Teach Claude your JSON Lines format
3. **Update the backend parser** - Handle your custom types
4. **Update the frontend types** - Add your custom fields
5. **Update the display** - Show your fields in the DraftCard

The **Builder Agent** can generate all of this for you through an interactive conversation.

## License

MIT
