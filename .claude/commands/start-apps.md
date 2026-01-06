# Start Apps

Start the development servers for the Teamwork applications.

## Instructions

Run the following commands to start the apps:

### Frontend (with SDK server)

```bash
cd apps/teamwork_frontend && bun run dev:all
```

This starts:
- Vite dev server (frontend)
- SDK server (backend API at server-sdk.ts)

### Individual Commands

**Frontend only:**
```bash
cd apps/teamwork_frontend && bun run dev
```

**SDK server only:**
```bash
cd apps/teamwork_frontend && bun run server
```

**API Client CLI:**
```bash
cd apps/teamwork_api_client && bun run cli
```

## Quick Start

For full development, run:
```bash
cd apps/teamwork_frontend && bun run dev:all
```
