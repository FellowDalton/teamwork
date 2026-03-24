/**
 * Mock Stream Simulator
 *
 * Simulates an NDJSON stream like what would come from an edge worker.
 * Each scenario produces a sequence of typed JSON lines with realistic delays.
 */

export type StreamScenario = 'project' | 'dashboard' | 'both';

const projectLines = [
  { type: 'project', name: 'E-Commerce Platform Redesign', description: 'Complete overhaul of the customer-facing storefront with modern UI/UX, improved checkout flow, and mobile-first responsive design.' },
  { type: 'tasklist', id: 'tl-1', name: 'Discovery & Research', description: 'User research and competitive analysis' },
  { type: 'task', id: 't-1', tasklistId: 'tl-1', name: 'Competitive analysis', description: 'Analyze top 5 competitors', priority: 'high', estimatedMinutes: 480 },
  { type: 'task', id: 't-2', tasklistId: 'tl-1', name: 'User interviews', description: 'Conduct 10 user interviews', priority: 'high', estimatedMinutes: 600 },
  { type: 'subtask', taskId: 't-2', name: 'Recruit participants' },
  { type: 'subtask', taskId: 't-2', name: 'Prepare interview script' },
  { type: 'subtask', taskId: 't-2', name: 'Schedule sessions' },
  { type: 'task', id: 't-3', tasklistId: 'tl-1', name: 'Analytics review', description: 'Review current site analytics', priority: 'medium', estimatedMinutes: 240 },
  { type: 'tasklist', id: 'tl-2', name: 'Design Phase', description: 'UI/UX design and prototyping' },
  { type: 'task', id: 't-4', tasklistId: 'tl-2', name: 'Wireframes', description: 'Low-fidelity wireframes for all pages', priority: 'high', estimatedMinutes: 960 },
  { type: 'subtask', taskId: 't-4', name: 'Homepage wireframe' },
  { type: 'subtask', taskId: 't-4', name: 'Product listing wireframe' },
  { type: 'subtask', taskId: 't-4', name: 'Checkout flow wireframe' },
  { type: 'subtask', taskId: 't-4', name: 'Mobile responsive variants' },
  { type: 'task', id: 't-5', tasklistId: 'tl-2', name: 'Visual design system', description: 'Create comprehensive design system', priority: 'high', estimatedMinutes: 720 },
  { type: 'task', id: 't-6', tasklistId: 'tl-2', name: 'Prototype', description: 'Interactive Figma prototype', priority: 'medium', estimatedMinutes: 480 },
  { type: 'tasklist', id: 'tl-3', name: 'Frontend Development', description: 'Build the new storefront' },
  { type: 'task', id: 't-7', tasklistId: 'tl-3', name: 'Setup Vite + TanStack Router', description: 'Initialize project with edge-ready stack', priority: 'high', estimatedMinutes: 240 },
  { type: 'task', id: 't-8', tasklistId: 'tl-3', name: 'Component library', description: 'Build reusable UI component library', priority: 'high', estimatedMinutes: 1200 },
  { type: 'subtask', taskId: 't-8', name: 'Button, Input, Card components' },
  { type: 'subtask', taskId: 't-8', name: 'Navigation and sidebar' },
  { type: 'subtask', taskId: 't-8', name: 'Product card component' },
  { type: 'task', id: 't-9', tasklistId: 'tl-3', name: 'Checkout flow', description: 'Multi-step checkout with Stripe', priority: 'high', estimatedMinutes: 960 },
  { type: 'task', id: 't-10', tasklistId: 'tl-3', name: 'Edge worker deployment', description: 'Deploy to Cloudflare Workers', priority: 'medium', estimatedMinutes: 480 },
  { type: 'tasklist', id: 'tl-4', name: 'QA & Launch', description: 'Testing and go-live' },
  { type: 'task', id: 't-11', tasklistId: 'tl-4', name: 'Cross-browser testing', description: 'Test on Chrome, Safari, Firefox, Edge', priority: 'high', estimatedMinutes: 480 },
  { type: 'task', id: 't-12', tasklistId: 'tl-4', name: 'Performance audit', description: 'Lighthouse scores > 90 across all pages', priority: 'medium', estimatedMinutes: 360 },
  { type: 'task', id: 't-13', tasklistId: 'tl-4', name: 'Launch checklist', description: 'DNS, SSL, CDN, monitoring setup', priority: 'high', estimatedMinutes: 240 },
  { type: 'complete', message: 'Project structure ready for review. 4 phases, 13 tasks, 10 subtasks. Estimated ~110 hours total.' },
];

const dashboardLines = [
  { type: 'dashboard_meta', title: 'Sprint 24 Overview', description: 'Performance metrics and team activity for the current sprint (Mar 18-31)' },
  { type: 'dashboard_metric', label: 'Velocity', value: '47', change: '+12%', trend: 'up' },
  { type: 'dashboard_metric', label: 'Open PRs', value: '8', change: '-3', trend: 'down' },
  { type: 'dashboard_metric', label: 'Bugs', value: '3', change: 'same', trend: 'neutral' },
  { type: 'dashboard_metric', label: 'Completion', value: '68%', change: '+15%', trend: 'up' },
  { type: 'dashboard_chart', title: 'Tasks Completed per Day', chartType: 'bar', data: [
    { label: 'Mon', value: 8 }, { label: 'Tue', value: 12 }, { label: 'Wed', value: 6 },
    { label: 'Thu', value: 15 }, { label: 'Fri', value: 10 }, { label: 'Sat', value: 3 }, { label: 'Sun', value: 1 },
  ]},
  { type: 'dashboard_chart', title: 'Story Points by Category', chartType: 'bar', data: [
    { label: 'Feature', value: 24 }, { label: 'Bug', value: 8 }, { label: 'Chore', value: 5 },
    { label: 'Spike', value: 10 },
  ]},
  { type: 'dashboard_activity', user: 'Sarah', action: 'merged PR #142 - Streaming UI framework', timestamp: '2 min ago' },
  { type: 'dashboard_activity', user: 'Alex', action: 'completed task: Edge worker deployment', timestamp: '15 min ago' },
  { type: 'dashboard_activity', user: 'Jordan', action: 'opened issue: TanStack Router hydration bug', timestamp: '32 min ago' },
  { type: 'dashboard_activity', user: 'Maya', action: 'deployed v2.4.1 to production', timestamp: '1 hour ago' },
  { type: 'dashboard_activity', user: 'Chris', action: 'updated design system tokens', timestamp: '2 hours ago' },
  { type: 'dashboard_complete' },
];

/** Simulate streaming NDJSON lines with realistic delays */
export async function simulateStream(
  scenario: StreamScenario,
  onChunk: (text: string) => void,
  options?: { speedMs?: number }
): Promise<void> {
  const baseDelay = options?.speedMs ?? 80;
  let lines: Record<string, unknown>[];

  switch (scenario) {
    case 'project':
      lines = projectLines;
      break;
    case 'dashboard':
      lines = dashboardLines;
      break;
    case 'both':
      lines = interleave(projectLines, dashboardLines);
      break;
  }

  for (const line of lines) {
    const json = JSON.stringify(line);
    onChunk(json + '\n');
    // Variable delay: headers are faster, tasks/activities take longer
    const delay = line.type === 'project' || line.type === 'dashboard_meta'
      ? baseDelay * 2
      : baseDelay + Math.random() * baseDelay;
    await sleep(delay);
  }
}

function interleave<T>(a: T[], b: T[]): T[] {
  const result: T[] = [];
  let ai = 0, bi = 0;
  while (ai < a.length || bi < b.length) {
    // Alternate with some randomness
    if (ai < a.length && (bi >= b.length || Math.random() > 0.4)) {
      result.push(a[ai++]);
    } else if (bi < b.length) {
      result.push(b[bi++]);
    }
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
