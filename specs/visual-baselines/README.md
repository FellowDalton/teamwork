# Visual Baselines

This directory contains baseline screenshots for visual regression testing during the restructuring refactor.

## Directory Structure

```
visual-baselines/
├── login-screen.png           # Login page before auth
├── status-mode/
│   ├── initial-state.png      # Status mode selected, empty chat
│   ├── message-sent.png       # Message in input, processing
│   ├── streaming-thinking.png # Thinking text appearing
│   ├── response-complete.png  # Full response in chat
│   ├── data-display-charts.png # Charts rendered in right panel
│   └── conversation-continued.png # After follow-up message
├── timelog-mode/
│   ├── initial-state.png      # Timelog mode selected
│   ├── draft-card-displayed.png # TimelogDraftCard visible
│   ├── draft-editable.png     # Editing hours in draft
│   └── submission-success.png # After successful submit
├── project-mode/
│   ├── initial-state.png      # Project mode selected
│   ├── streaming-project-build.png # Draft building progressively
│   ├── draft-card-complete.png # Complete project draft
│   └── project-created-success.png # After creation
└── mode-switching/
    ├── status-to-timelog.png  # Mid-switch state
    ├── timelog-to-project.png
    └── project-to-status.png
```

## Capturing Baselines

Before starting any refactoring work:

### 1. Start the app in current working state

```bash
# Terminal 1
cd apps/teamwork_backend && bun run server-sdk.ts

# Terminal 2
cd apps/teamwork_frontend && bun run dev
```

### 2. Use Claude in Chrome to capture screenshots

For each scenario, navigate to the state and capture:

```typescript
// Example: Capture status mode initial state
navigate({ url: "http://localhost:5173", tabId })
computer({ action: "wait", duration: 3, tabId })
computer({ action: "screenshot", tabId })
// Save as: status-mode/initial-state.png
```

### 3. Save with descriptive names

Use the naming convention: `{mode}/{state}.png`

### 4. Commit baselines

```bash
git add specs/visual-baselines/
git commit -m "chore: Capture visual baselines before restructuring"
git tag visual-baseline-v1
```

## Using Baselines for Testing

After each code change:

1. Take a screenshot at the same checkpoint
2. Compare visually to baseline
3. Expected differences:
   - Timestamps/dates (dynamic content)
   - User-specific data (hours logged, task names)
   - Minor layout shifts (within ~5px)
4. Unexpected differences (FAILURE):
   - Missing UI elements
   - Broken layouts
   - Wrong mode displayed
   - Empty data where data expected
   - Console errors visible

## Updating Baselines

Only update baselines when:
- Intentionally changing UI design
- Adding new features that change appearance
- Fixing bugs that affect visuals

Always document the reason:

```bash
git commit -m "chore: Update baselines - added new chart type to status mode"
```

## Baseline Versions

- `visual-baseline-v1` - Pre-restructuring (original working state)
- `visual-baseline-v2` - After Phase 1-4 (backend complete)
- `visual-baseline-v3` - After Phase 5-6 (frontend complete)
- `visual-baseline-final` - Post-restructuring (new architecture)
