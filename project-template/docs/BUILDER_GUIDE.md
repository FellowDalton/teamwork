# Builder Guide

This guide walks you through customizing the Chat Builder Template for your specific use case.

## Understanding the Template

The template creates **structured content progressively** using this pattern:

```
User describes what they want
       ↓
Claude generates JSON Lines
       ↓
Backend parses and emits SSE events
       ↓
Frontend renders items as they arrive
       ↓
User reviews, edits, submits
```

The default example is an **Outline Builder**. You can adapt it to build anything hierarchical.

---

## Step 1: Define Your Domain

First, decide what you're building. Ask yourself:

| Question | Outline Builder | Your Use Case |
|----------|-----------------|---------------|
| What is the top-level thing? | Outline | ? |
| What are the main groupings? | Sections | ? |
| What are the items in each group? | Points | ? |
| What details can items have? | Sub-points | ? |

### Examples

| Use Case | Top Level | Groupings | Items | Details |
|----------|-----------|-----------|-------|---------|
| **Project Planner** | Project | Phases | Tasks | Subtasks |
| **Recipe Builder** | Recipe | Sections (Prep, Cook) | Steps | Tips |
| **Course Creator** | Course | Modules | Lessons | Topics |
| **Meeting Agenda** | Agenda | Topics | Discussion Points | Action Items |
| **API Designer** | API Spec | Resources | Endpoints | Parameters |

---

## Step 2: Define Your Schema

Update the JSON Lines types for your domain. Edit `backend/server.ts`:

```typescript
// Instead of generic "draft/section/item/subitem", use your domain terms:

// Project Planner example:
{"type":"project","name":"Website Redesign","description":"Q1 2024 initiative"}
{"type":"phase","id":"p1","name":"Discovery","description":"Research and planning"}
{"type":"task","id":"t1","phaseId":"p1","name":"User interviews","estimate":"8h","priority":"high"}
{"type":"subtask","taskId":"t1","name":"Create interview script"}
{"type":"subtask","taskId":"t1","name":"Schedule 5 participants"}

// Recipe Builder example:
{"type":"recipe","name":"Chocolate Cake","servings":8,"prepTime":"20min","cookTime":"35min"}
{"type":"section","id":"s1","name":"Ingredients"}
{"type":"ingredient","id":"i1","sectionId":"s1","name":"All-purpose flour","amount":"2 cups"}
{"type":"section","id":"s2","name":"Instructions"}
{"type":"step","id":"st1","sectionId":"s2","name":"Preheat oven to 350°F"}
{"type":"tip","stepId":"st1","name":"Use an oven thermometer for accuracy"}
```

---

## Step 3: Update the System Prompt

The system prompt teaches Claude your schema. Edit `backend/server.ts`:

```typescript
const SYSTEM_PROMPTS: Record<string, string> = {
  create: `You are a [YOUR DOMAIN] Builder that creates [WHAT] progressively.

When the user describes what they want, generate using JSON Lines format.

## Output Format

1. Start with the [TOP LEVEL]:
{"type":"[your_type]","name":"...","[custom_field]":"..."}

2. Add [GROUPINGS]:
{"type":"[grouping_type]","id":"...","name":"..."}

3. Add [ITEMS]:
{"type":"[item_type]","id":"...","[grouping]Id":"...","name":"...","[custom_fields]":"..."}

4. Add [DETAILS] (optional):
{"type":"[detail_type]","[item]Id":"...","name":"..."}

5. End with:
{"type":"complete","message":"..."}

## Guidelines
- [Domain-specific rules]
- [How to structure content]
- [What makes a good output]

## Example
[Show a complete example for a typical request]
`,
};
```

---

## Step 4: Update Backend Parsing

Update the SSE event parsing in `backend/server.ts` to handle your types:

```typescript
switch (parsed.type) {
  // Your top-level type
  case 'project':  // or 'recipe', 'course', etc.
    enqueue(JSON.stringify({
      type: 'draft_init',
      draft: {
        id: `draft-${Date.now()}`,
        name: parsed.name,
        // Add your custom fields
        estimate: parsed.estimate,
        priority: parsed.priority,
        sections: [],
        summary: { /* your summary stats */ },
        isDraft: true,
        isBuilding: true,
      },
    }));
    break;

  // Your grouping type
  case 'phase':  // or 'module', 'section', etc.
    enqueue(JSON.stringify({
      type: 'draft_update',
      action: 'add_section',
      section: {
        id: parsed.id,
        name: parsed.name,
        // Custom fields
        description: parsed.description,
        items: [],
      },
    }));
    break;

  // Your item type
  case 'task':  // or 'lesson', 'step', etc.
    enqueue(JSON.stringify({
      type: 'draft_update',
      action: 'add_item',
      sectionId: parsed.phaseId,  // Match your schema
      item: {
        id: parsed.id,
        name: parsed.name,
        // Custom fields
        estimate: parsed.estimate,
        priority: parsed.priority,
        children: [],
      },
    }));
    break;

  // Your detail type
  case 'subtask':  // or 'topic', 'tip', etc.
    enqueue(JSON.stringify({
      type: 'draft_update',
      action: 'add_subitem',
      itemId: parsed.taskId,  // Match your schema
      subitems: [{
        id: `subitem-${Date.now()}`,
        name: parsed.name,
      }],
    }));
    break;
}
```

---

## Step 5: Update Frontend Types

Update `frontend/src/types/conversation.ts`:

```typescript
// Add your custom fields to the interfaces

export interface DraftData {
  id: string;
  name: string;
  description?: string;

  // Add domain-specific fields
  estimate?: string;      // For project planner
  servings?: number;      // For recipe builder
  duration?: string;      // For course creator

  sections: DraftSection[];
  summary: DraftSummary;
  // ...
}

export interface DraftItem {
  id: string;
  name: string;
  description?: string;

  // Add item-specific fields
  estimate?: string;
  priority?: 'low' | 'medium' | 'high';
  amount?: string;        // For ingredients

  children?: DraftSubItem[];
}
```

---

## Step 6: Update DraftCard Display

Customize how items are displayed in `frontend/src/components/DraftCard.tsx`:

```tsx
// In ItemCard component, add your custom fields:

<div className="flex items-center justify-between">
  <span className="text-sm text-zinc-200">{item.name}</span>

  {/* Show priority badge */}
  {item.priority && (
    <span className={`text-xs px-2 py-0.5 rounded ${
      item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
      item.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
      'bg-zinc-500/20 text-zinc-400'
    }`}>
      {item.priority}
    </span>
  )}

  {/* Show estimate */}
  {item.estimate && (
    <span className="text-xs text-zinc-500">{item.estimate}</span>
  )}
</div>
```

---

## Step 7: Update Submit Handler

Customize what happens when the user submits in `backend/server.ts`:

```typescript
async function handleSubmit(req: Request): Promise<Response> {
  const body = await req.json();

  // Option 1: Save to database
  // await db.projects.create({ data: body });

  // Option 2: Call external API
  // await fetch('https://api.example.com/projects', {
  //   method: 'POST',
  //   body: JSON.stringify(body),
  // });

  // Option 3: Generate file
  // const markdown = convertToMarkdown(body);
  // await Bun.write(`./outputs/${body.id}.md`, markdown);

  return Response.json({
    success: true,
    id: body.id,
    url: `https://your-app.com/view/${body.id}`,
    message: `Created "${body.name}" successfully!`,
  });
}
```

---

## Complete Example: Project Planner

Here's a complete transformation from Outline Builder to Project Planner:

### 1. System Prompt

```typescript
create: `You are a Project Planner that creates project structures progressively.

## Output Format

{"type":"project","name":"Project Name","description":"Brief description","deadline":"YYYY-MM-DD"}
{"type":"phase","id":"p1","name":"Phase Name","description":"Phase goals"}
{"type":"task","id":"t1","phaseId":"p1","name":"Task","estimate":"Xh","priority":"high|medium|low"}
{"type":"subtask","taskId":"t1","name":"Subtask description"}
{"type":"complete","message":"Project plan ready!"}

## Guidelines
- Create 3-5 phases covering the project lifecycle
- Each phase should have 3-7 tasks
- Estimates should be realistic (use hours for small tasks, days for larger)
- High priority = blocking or critical path
- Add subtasks for complex tasks that need breakdown

## Example
User: "Plan a mobile app launch"

{"type":"project","name":"Mobile App Launch","description":"Launch v1.0 of our fitness app","deadline":"2024-03-15"}
{"type":"phase","id":"p1","name":"Pre-Launch","description":"Preparation and testing"}
{"type":"task","id":"t1","phaseId":"p1","name":"Beta testing","estimate":"2w","priority":"high"}
{"type":"subtask","taskId":"t1","name":"Recruit 50 beta testers"}
{"type":"subtask","taskId":"t1","name":"Set up feedback collection"}
{"type":"task","id":"t2","phaseId":"p1","name":"App store assets","estimate":"3d","priority":"medium"}
{"type":"phase","id":"p2","name":"Launch Week","description":"Go-live activities"}
{"type":"task","id":"t3","phaseId":"p2","name":"Submit to app stores","estimate":"1d","priority":"high"}
{"type":"task","id":"t4","phaseId":"p2","name":"Press release","estimate":"4h","priority":"medium"}
{"type":"complete","message":"Launch plan created!"}
`
```

### 2. Frontend Types

```typescript
export interface DraftItem {
  id: string;
  name: string;
  description?: string;
  estimate?: string;
  priority?: 'high' | 'medium' | 'low';
  children?: DraftSubItem[];
}
```

### 3. DraftCard Display

```tsx
{item.priority && (
  <span className={`text-xs px-1.5 py-0.5 rounded ${
    item.priority === 'high' ? 'bg-red-900/50 text-red-400 border border-red-800' :
    item.priority === 'medium' ? 'bg-amber-900/50 text-amber-400 border border-amber-800' :
    'bg-zinc-800 text-zinc-400 border border-zinc-700'
  }`}>
    {item.priority}
  </span>
)}
{item.estimate && (
  <span className="text-xs text-cyan-500 font-mono">{item.estimate}</span>
)}
```

---

## Tips

1. **Start simple** - Get basic structure working before adding custom fields
2. **Test incrementally** - Verify each change works before moving on
3. **Use the example prompt** - Good examples in the system prompt improve output quality
4. **Keep IDs consistent** - Section IDs must match when adding items to them
5. **Handle missing fields** - Not every item needs every field, use optional chaining

---

## Need Help?

Use the Builder Agent prompt in `docs/BUILDER_AGENT.md` to have Claude help you:
- Design your schema
- Write your system prompt
- Generate the TypeScript types
- Create the display components
