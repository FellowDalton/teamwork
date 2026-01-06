---
name: sub-agent-invocation
description: "Coordination and delegation protocols for sub-agent specialist assignments"
---

# Central AI Delegation Protocol

Load this skill before invoking ANY sub-agent (master-orchestrator, specialists, validators).

---

## Constitutional Invocation Requirements

Every sub-agent prompt **MUST** include four components:

### 1. Complete Context (Be Detailed)

- Project goal and current state
- Why this work is needed now
- How this task fits into broader objectives
- Dependencies on other work or prior decisions

### 2. Explicit Instructions (Be Clear)

- Specific task requirements with clear scope
- Expected deliverables and exact format
- Success criteria and validation requirements

### 3. Context References (Point to Sources)

- Session files: "Read .claude/tasks/session-current.md for full context"
- Skills: "Load [relevant] skill for patterns and workflows"
- Related implementations: Point to similar existing code

### 4. Performance Directives (Demand Excellence)

- Always include: "Think hard and analyze deeply before proceeding"
- Specify thoroughness level: "comprehensive analysis" or "quick validation"

---

## Invocation Template

```
"USER'S ORIGINAL REQUEST: [verbatim user prompt - MANDATORY]

[COMPREHENSIVE CONTEXT]
- Project: [overall goal and current state]
- Background: [why this matters, how it fits]
- Dependencies: [what this builds on or integrates with]

TASK ASSIGNMENT:
[Detailed, specific requirements with clear scope and boundaries]

CONTEXT REFERENCES:
- Session: [path and what to extract]
- Skills: [relevant skills to load]
- Examples: [similar existing implementations]

Think hard and provide [thoroughness level] analysis/implementation.

DELIVERABLES:
[Exact format, success criteria, validation requirements]"
```

**Sub-Agent Context Principle**: Sub-agents have temporary windows—maximize their context collection. Over-collection is safe; under-collection causes failures.

---

## Common Invocation Failures

| Bad | Good |
|-----|------|
| "Fix authentication" | "Fix OAuth redirect loop where successful login redirects to /login instead of /dashboard" |
| "Add tests" | "Add tests for user profile editing (session Phase 2) covering avatar upload, validation, error handling" |
| "Implement feature X" | "Implement feature X following patterns from Y, integrating with Z API, referencing session-current.md Phase 3" |

---

## Routing Decision

| Scenario | Approach |
|----------|----------|
| Multi-phase feature, complex dependencies | Master Orchestrator → Session |
| Simple file edit, pattern search, single-component | Direct sub-agent delegation |
| Ambiguous scope, needs planning | Master Orchestrator |
| Clear scope, bounded execution | Direct delegation |

---

## Coordination Patterns

### Parallel Execution

Invoke multiple agents using multiple Task tool calls in **ONE message**.

| Pattern | Agents | Use Case |
|---------|--------|----------|
| **Domain Parallel** | frontend + backend + database | Independent feature development |
| **Validation Parallel** | security + performance + quality | Comprehensive validation |
| **Debug Parallel** | debugger-detective + deep-researcher | Complex issue investigation |

### Sequential Dependencies

| Chain | Reasoning |
|-------|-----------|
| Schema → API → Frontend | Data structure must exist before interfaces |
| Core → Enhancement | Foundation before optimization |
| Implementation → Testing → Security | Build, validate, secure |
| Research → Planning → Execution | Understand, plan, implement |

---

## Agent Routing Reference

| Domain | Agent | Handles |
|--------|-------|---------|
| **Frontend** | frontend-specialist | React, UI, state, forms, responsive design |
| **Backend** | backend-engineer | Server actions, APIs, business logic, auth |
| **Database** | supabase-specialist | Schema, migrations, RLS, real-time |
| **Testing** | quality-engineer | Unit, integration, E2E, coverage |
| **Security** | security-auditor | Auth security, RLS validation, vulnerabilities |
| **Performance** | performance-optimizer | Core Web Vitals, bundle analysis, monitoring |
