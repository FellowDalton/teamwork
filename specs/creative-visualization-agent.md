# Creative Visualization Agent Architecture

## Problem

Current architecture has Haiku (CardAgent) making decisions about WHAT to display, leading to:
- Wrong data selection (5 recent entries instead of full summary)
- Incorrect totals (27h shown when actual is 278h)
- No flexibility in visualization types

## Proposed Architecture

```
User Query: "How many hours last 7 months?"
         ↓
┌─────────────────────────────────────────────────────┐
│  Main Opus (Conversational Agent)                   │
│  - Analyzes data, provides insights                 │
│  - Returns text response                            │
│  - Signals: [[VISUALIZE]] with context              │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│  Creative Opus (Visualization Agent)                │
│  - Receives: user question + full data + analysis   │
│  - Decides: what visualization type fits best       │
│  - Creates: visualization spec (can be custom)      │
│  - Can define new card/chart types on the fly       │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│  Frontend Renderer                                  │
│  - Interprets visualization spec                    │
│  - Renders: cards, charts, tables, custom elements  │
│  - Flexible schema-driven rendering                 │
└─────────────────────────────────────────────────────┘
```

## Agent Responsibilities

### Main Opus (Existing)
- Conversational interface
- Data analysis and insights
- Text response generation
- Signals when visualization would help

### Creative Opus (New)
- **Input:** User question, time entries data, main agent's analysis
- **Decision making:**
  - Should I show individual cards or a summary?
  - Would a chart better answer this question?
  - What time grouping makes sense (by day, week, month)?
  - What's the most important data to highlight?
- **Output:** Structured visualization specification

### Visualization Types

#### 1. Summary Card (for aggregate questions)
```json
{
  "type": "summary",
  "title": "Last 7 Months Activity",
  "metrics": [
    { "label": "Total Hours", "value": "278.2h", "emphasis": true },
    { "label": "Tasks", "value": "47" },
    { "label": "Entries", "value": "109" },
    { "label": "Avg/Week", "value": "9.9h" }
  ]
}
```

#### 2. Time Entry Cards (for "what did I work on" questions)
```json
{
  "type": "cards",
  "items": [
    { "task": "...", "project": "...", "hours": 7.5, "date": "..." }
  ],
  "groupBy": "date",  // or "task", "project"
  "limit": 15
}
```

#### 3. Bar Chart (for comparisons)
```json
{
  "type": "chart",
  "chartType": "bar",
  "title": "Hours by Month",
  "data": [
    { "label": "Jun", "value": 42.5 },
    { "label": "Jul", "value": 38.0 },
    ...
  ]
}
```

#### 4. Line Chart (for trends)
```json
{
  "type": "chart",
  "chartType": "line",
  "title": "Weekly Hours Trend",
  "data": [...]
}
```

#### 5. Custom Card (agent-defined)
```json
{
  "type": "custom",
  "layout": "stat-highlight",
  "content": {
    "headline": "278.2 hours",
    "subtext": "across 47 tasks in 7 months",
    "breakdown": [
      { "label": "KiroViden", "value": "278.2h", "percentage": 100 }
    ]
  }
}
```

## Creative Agent System Prompt

```
You are a data visualization expert. Given user questions and time tracking data, 
you decide the BEST way to visualize the answer.

DECISION FRAMEWORK:
1. "How many hours?" → Summary card with total + breakdown
2. "What did I work on?" → Recent activity cards grouped by date
3. "Show trend/over time" → Line chart
4. "Compare projects/tasks" → Bar chart
5. Complex questions → Multiple visualizations

RULES:
- ALWAYS include accurate totals from the data
- For aggregate questions, show SUMMARY not individual entries
- For "what did I" questions, show recent ACTIVITIES
- Choose visualization that DIRECTLY answers the question
- You can create custom layouts if standard types don't fit

OUTPUT: Return JSON visualization spec only.
```

## Implementation Steps

### Phase 1: Creative Agent Setup
1. Create `prompts/agents/visualization-agent.txt` with decision framework
2. Add `callVisualizationAgent()` in agentService.ts
3. Replace CardAgent call with VisualizationAgent in streaming handler

### Phase 2: Enhanced Visualization Types
1. Add summary card component to frontend
2. Add chart components (using Chart.js or similar)
3. Create flexible renderer for agent-defined schemas

### Phase 3: Custom Visualizations
1. Allow agent to define custom card layouts
2. Frontend interprets layout specs dynamically
3. Add more chart types as needed

## Example Flow

**User:** "How many hours did I log last 7 months?"

**Main Opus Response:**
```
You logged 278.2 hours on KiroViden - Klyngeplatform over the last 7 months.
That's an average of about 40 hours per month or 10 hours per week.
Your busiest month was October with 52 hours.

[[VISUALIZE]]
```

**Creative Opus Input:**
```json
{
  "question": "How many hours did I log last 7 months?",
  "analysis": "278.2 hours total, 47 tasks, 109 entries",
  "data": { /* full time entries */ },
  "period": "Last 7 months"
}
```

**Creative Opus Output:**
```json
{
  "visualizations": [
    {
      "type": "summary",
      "title": "7 Month Summary",
      "metrics": [
        { "label": "Total Hours", "value": "278.2h", "emphasis": true },
        { "label": "Tasks Worked", "value": "47" },
        { "label": "Time Entries", "value": "109" },
        { "label": "Avg Per Week", "value": "9.9h" }
      ]
    },
    {
      "type": "chart",
      "chartType": "bar",
      "title": "Hours by Month",
      "data": [
        { "label": "Jun", "value": 35.5 },
        { "label": "Jul", "value": 42.0 },
        { "label": "Aug", "value": 38.5 },
        { "label": "Sep", "value": 45.0 },
        { "label": "Oct", "value": 52.0 },
        { "label": "Nov", "value": 48.2 },
        { "label": "Dec", "value": 17.0 }
      ]
    }
  ]
}
```

**Frontend Renders:**
- Summary card with 278.2h highlighted
- Bar chart showing monthly breakdown

## Cost Considerations

- Main Opus: CLI (subscription) - free
- Creative Opus: API call - ~$0.015-0.03 per query (Sonnet) or ~$0.08-0.15 (Opus)
- Haiku: Could still be used for simple formatting tasks

**Recommendation:** Use Sonnet 3.5 for Creative Agent (good balance of intelligence and cost)

## Files to Create/Modify

### New Files
- `prompts/agents/visualization-agent.txt` - Creative agent prompt
- `apps/teamwork_frontend/components/SummaryCard.tsx` - Summary visualization
- `apps/teamwork_frontend/components/ChartCard.tsx` - Chart visualization

### Modified Files
- `apps/teamwork_frontend/services/agentService.ts` - Add visualization agent
- `apps/teamwork_frontend/server.ts` - Call visualization agent
- `apps/teamwork_frontend/components/DataDisplayPanel.tsx` - Render new types
- `apps/teamwork_frontend/components/DataCard.tsx` - Support custom layouts
