# ADWs-Bun: AI Developer Workflows (Bun/TypeScript)

This is a modern TypeScript/Bun implementation of the AI Developer Workflows system, migrated from Python.

## Quick Start

```bash
# Install dependencies
bun install

# Run Teamwork task monitor
bun run trigger:teamwork

# Run in dry-run mode
bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts --dry-run

# Run once (no continuous polling)
bun run src/triggers/adw-trigger-cron-teamwork-tasks.ts --once
```

## Architecture

```
adws-bun/
├── src/
│   ├── modules/          # Core shared modules
│   │   ├── data-models.ts    # Zod schemas and type definitions
│   │   ├── agent.ts          # Agent execution framework
│   │   └── utils.ts          # Utility functions
│   ├── workflows/        # Task execution workflows
│   │   ├── adw-build-update-teamwork-task.ts
│   │   └── adw-plan-implement-update-teamwork-task.ts
│   ├── triggers/         # Task monitoring daemons
│   │   ├── adw-trigger-cron-teamwork-tasks.ts
│   │   └── adw-trigger-cron-notion-tasks.ts
│   └── cli/              # CLI tools
│       ├── adw-prompt.ts
│       └── adw-slash-command.ts
├── tests/                # Test suite
└── dist/                 # Compiled output
```

## Key Features

- **Type-safe**: Full TypeScript with strict mode and Zod runtime validation
- **Fast**: Leverages Bun's native APIs for subprocess, file I/O, and JSON parsing
- **Modern**: Uses async/await, native Promises, and ES modules
- **Compatible**: Drop-in replacement for Python version with same interfaces

## Migration Status

- [x] Project foundation and configuration
- [ ] Data models (Zod schemas)
- [ ] Agent framework (subprocess execution)
- [ ] Utilities
- [ ] Build workflows
- [ ] Plan-implement workflows
- [ ] Task monitoring daemons
- [ ] CLI tools
- [ ] Test suite

## Development

```bash
# Type checking
bun run lint

# Format code
bun run format

# Run tests
bun test

# Run tests in watch mode
bun test --watch
```
