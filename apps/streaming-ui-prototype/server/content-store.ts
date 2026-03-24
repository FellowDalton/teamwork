/**
 * Mock Content Store
 *
 * In production, this would be Supabase with pgvector embeddings.
 * For the prototype, we use an in-memory store with keyword-based search.
 */

export interface ContentBlock {
  id: string;
  blockType: string;
  title: string;
  content: Record<string, unknown>;
  tags: string[];
  source: string;
  updatedAt: string;
}

export interface PageTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  blockRefs: string[];
  pluginType: string;
}

// ──────────────────────────────────────────────
// Sample Content Blocks
// ──────────────────────────────────────────────

const contentBlocks: ContentBlock[] = [
  // Metrics
  {
    id: 'cb-1', blockType: 'metric', title: 'Monthly Revenue',
    content: { value: '$284K', change: '+18.2%', trend: 'up', period: 'March 2026' },
    tags: ['sales', 'revenue', 'finance', 'kpi'], source: 'stripe', updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'cb-2', blockType: 'metric', title: 'Active Users',
    content: { value: '12,847', change: '+5.3%', trend: 'up', period: 'This week' },
    tags: ['users', 'engagement', 'product', 'kpi'], source: 'analytics', updatedAt: '2026-03-24T09:00:00Z',
  },
  {
    id: 'cb-3', blockType: 'metric', title: 'Support Tickets',
    content: { value: '23', change: '-12', trend: 'down', period: 'Open' },
    tags: ['support', 'tickets', 'customer'], source: 'zendesk', updatedAt: '2026-03-24T08:00:00Z',
  },
  {
    id: 'cb-4', blockType: 'metric', title: 'Deployment Frequency',
    content: { value: '4.2/day', change: '+0.8', trend: 'up', period: 'Last 7 days' },
    tags: ['engineering', 'devops', 'deployment', 'velocity'], source: 'github', updatedAt: '2026-03-24T07:00:00Z',
  },
  {
    id: 'cb-5', blockType: 'metric', title: 'Churn Rate',
    content: { value: '2.1%', change: '-0.3%', trend: 'down', period: 'March 2026' },
    tags: ['sales', 'churn', 'retention', 'finance'], source: 'stripe', updatedAt: '2026-03-24T06:00:00Z',
  },
  {
    id: 'cb-6', blockType: 'metric', title: 'NPS Score',
    content: { value: '72', change: '+4', trend: 'up', period: 'Q1 2026' },
    tags: ['customer', 'satisfaction', 'nps', 'product'], source: 'survey', updatedAt: '2026-03-24T05:00:00Z',
  },
  {
    id: 'cb-7', blockType: 'metric', title: 'Sprint Velocity',
    content: { value: '47 pts', change: '+12%', trend: 'up', period: 'Sprint 24' },
    tags: ['engineering', 'velocity', 'sprint', 'agile'], source: 'jira', updatedAt: '2026-03-24T04:00:00Z',
  },
  {
    id: 'cb-8', blockType: 'metric', title: 'API Uptime',
    content: { value: '99.97%', change: '+0.02%', trend: 'up', period: 'Last 30 days' },
    tags: ['engineering', 'reliability', 'uptime', 'sla'], source: 'monitoring', updatedAt: '2026-03-24T03:00:00Z',
  },

  // Charts
  {
    id: 'cb-10', blockType: 'chart', title: 'Revenue by Month',
    content: {
      chartType: 'bar',
      data: [
        { label: 'Oct', value: 195000 }, { label: 'Nov', value: 218000 },
        { label: 'Dec', value: 242000 }, { label: 'Jan', value: 251000 },
        { label: 'Feb', value: 267000 }, { label: 'Mar', value: 284000 },
      ],
    },
    tags: ['sales', 'revenue', 'finance', 'chart', 'monthly'], source: 'stripe', updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'cb-11', blockType: 'chart', title: 'User Growth',
    content: {
      chartType: 'bar',
      data: [
        { label: 'Oct', value: 9200 }, { label: 'Nov', value: 9800 },
        { label: 'Dec', value: 10500 }, { label: 'Jan', value: 11200 },
        { label: 'Feb', value: 11900 }, { label: 'Mar', value: 12847 },
      ],
    },
    tags: ['users', 'growth', 'product', 'chart', 'monthly'], source: 'analytics', updatedAt: '2026-03-24T09:00:00Z',
  },
  {
    id: 'cb-12', blockType: 'chart', title: 'Tasks Completed This Sprint',
    content: {
      chartType: 'bar',
      data: [
        { label: 'Mon', value: 8 }, { label: 'Tue', value: 12 },
        { label: 'Wed', value: 6 }, { label: 'Thu', value: 15 },
        { label: 'Fri', value: 10 },
      ],
    },
    tags: ['engineering', 'sprint', 'velocity', 'chart', 'tasks'], source: 'jira', updatedAt: '2026-03-24T08:00:00Z',
  },
  {
    id: 'cb-13', blockType: 'chart', title: 'Support Tickets by Category',
    content: {
      chartType: 'bar',
      data: [
        { label: 'Billing', value: 8 }, { label: 'Bug', value: 5 },
        { label: 'Feature', value: 4 }, { label: 'Account', value: 3 },
        { label: 'Other', value: 3 },
      ],
    },
    tags: ['support', 'tickets', 'chart', 'categories'], source: 'zendesk', updatedAt: '2026-03-24T07:00:00Z',
  },

  // Activities
  {
    id: 'cb-20', blockType: 'activity', title: 'Recent Team Activity',
    content: {
      entries: [
        { user: 'Sarah', action: 'merged PR #142 - Streaming UI framework', timestamp: '10 min ago' },
        { user: 'Alex', action: 'deployed v2.4.1 to production', timestamp: '25 min ago' },
        { user: 'Jordan', action: 'closed issue #89 - Login redirect bug', timestamp: '1 hour ago' },
        { user: 'Maya', action: 'completed design review for checkout flow', timestamp: '2 hours ago' },
        { user: 'Chris', action: 'added 3 new API endpoints', timestamp: '3 hours ago' },
      ],
    },
    tags: ['team', 'activity', 'engineering', 'recent'], source: 'github', updatedAt: '2026-03-24T10:30:00Z',
  },
  {
    id: 'cb-21', blockType: 'activity', title: 'Sales Activity',
    content: {
      entries: [
        { user: 'Lisa', action: 'closed deal with Acme Corp ($45K ARR)', timestamp: '30 min ago' },
        { user: 'Tom', action: 'scheduled demo with TechStart Inc', timestamp: '1 hour ago' },
        { user: 'Nina', action: 'sent proposal to GlobalTech', timestamp: '2 hours ago' },
        { user: 'Dave', action: 'updated pipeline forecast Q2', timestamp: '4 hours ago' },
      ],
    },
    tags: ['sales', 'activity', 'deals', 'pipeline'], source: 'crm', updatedAt: '2026-03-24T10:00:00Z',
  },

  // Project/Task data
  {
    id: 'cb-30', blockType: 'project_template', title: 'Website Redesign',
    content: {
      description: 'Complete redesign of the marketing website with modern stack',
      phases: [
        {
          name: 'Research & Discovery', tasks: [
            { name: 'Audit existing site', priority: 'high', estimatedMinutes: 480 },
            { name: 'Competitor analysis', priority: 'high', estimatedMinutes: 360 },
            { name: 'User survey', priority: 'medium', estimatedMinutes: 240 },
          ],
        },
        {
          name: 'Design', tasks: [
            { name: 'Wireframes', priority: 'high', estimatedMinutes: 720, subtasks: ['Homepage', 'About', 'Pricing', 'Blog'] },
            { name: 'Visual design system', priority: 'high', estimatedMinutes: 960 },
            { name: 'Prototype', priority: 'medium', estimatedMinutes: 480 },
          ],
        },
        {
          name: 'Development', tasks: [
            { name: 'Setup Vite + TanStack Router', priority: 'high', estimatedMinutes: 240 },
            { name: 'Build component library', priority: 'high', estimatedMinutes: 1200 },
            { name: 'CMS integration', priority: 'medium', estimatedMinutes: 480 },
            { name: 'Edge worker deployment', priority: 'medium', estimatedMinutes: 360 },
          ],
        },
        {
          name: 'Launch', tasks: [
            { name: 'QA testing', priority: 'high', estimatedMinutes: 480 },
            { name: 'Performance optimization', priority: 'medium', estimatedMinutes: 360 },
            { name: 'DNS & SSL setup', priority: 'high', estimatedMinutes: 120 },
          ],
        },
      ],
    },
    tags: ['project', 'website', 'redesign', 'template'], source: 'templates', updatedAt: '2026-03-20T00:00:00Z',
  },
  {
    id: 'cb-31', blockType: 'project_template', title: 'Mobile App MVP',
    content: {
      description: 'Build a cross-platform mobile app MVP with React Native',
      phases: [
        {
          name: 'Planning', tasks: [
            { name: 'Define user stories', priority: 'high', estimatedMinutes: 480 },
            { name: 'API specification', priority: 'high', estimatedMinutes: 360 },
            { name: 'Tech stack decision', priority: 'medium', estimatedMinutes: 120 },
          ],
        },
        {
          name: 'Core Development', tasks: [
            { name: 'Authentication flow', priority: 'high', estimatedMinutes: 480, subtasks: ['Email/password', 'Social login', 'Biometric'] },
            { name: 'Main feed screen', priority: 'high', estimatedMinutes: 720 },
            { name: 'Profile management', priority: 'medium', estimatedMinutes: 360 },
            { name: 'Push notifications', priority: 'medium', estimatedMinutes: 480 },
          ],
        },
        {
          name: 'Polish & Launch', tasks: [
            { name: 'UI polish & animations', priority: 'medium', estimatedMinutes: 480 },
            { name: 'App store submission', priority: 'high', estimatedMinutes: 240 },
            { name: 'Beta testing', priority: 'high', estimatedMinutes: 360 },
          ],
        },
      ],
    },
    tags: ['project', 'mobile', 'app', 'mvp', 'template'], source: 'templates', updatedAt: '2026-03-18T00:00:00Z',
  },
  {
    id: 'cb-32', blockType: 'project_template', title: 'API Platform',
    content: {
      description: 'Build a scalable REST/GraphQL API platform with documentation',
      phases: [
        {
          name: 'Architecture', tasks: [
            { name: 'Schema design', priority: 'high', estimatedMinutes: 480 },
            { name: 'Auth strategy (JWT/OAuth)', priority: 'high', estimatedMinutes: 360 },
            { name: 'Rate limiting design', priority: 'medium', estimatedMinutes: 240 },
          ],
        },
        {
          name: 'Implementation', tasks: [
            { name: 'CRUD endpoints', priority: 'high', estimatedMinutes: 960 },
            { name: 'Webhook system', priority: 'medium', estimatedMinutes: 480, subtasks: ['Event definitions', 'Delivery queue', 'Retry logic'] },
            { name: 'API documentation', priority: 'high', estimatedMinutes: 360 },
            { name: 'SDK generation', priority: 'low', estimatedMinutes: 480 },
          ],
        },
        {
          name: 'Operations', tasks: [
            { name: 'Monitoring & alerting', priority: 'high', estimatedMinutes: 360 },
            { name: 'Load testing', priority: 'medium', estimatedMinutes: 240 },
            { name: 'CI/CD pipeline', priority: 'high', estimatedMinutes: 360 },
          ],
        },
      ],
    },
    tags: ['project', 'api', 'platform', 'backend', 'template'], source: 'templates', updatedAt: '2026-03-15T00:00:00Z',
  },
];

// ──────────────────────────────────────────────
// Page Templates
// ──────────────────────────────────────────────

const pageTemplates: PageTemplate[] = [
  {
    id: 'pt-1', slug: 'sales-dashboard', name: 'Sales Dashboard',
    description: 'Revenue metrics, sales activity, and pipeline overview',
    blockRefs: ['cb-1', 'cb-5', 'cb-10', 'cb-21'],
    pluginType: 'dashboard',
  },
  {
    id: 'pt-2', slug: 'engineering-dashboard', name: 'Engineering Dashboard',
    description: 'Sprint velocity, deployment stats, and team activity',
    blockRefs: ['cb-4', 'cb-7', 'cb-8', 'cb-12', 'cb-20'],
    pluginType: 'dashboard',
  },
  {
    id: 'pt-3', slug: 'product-overview', name: 'Product Overview',
    description: 'User engagement, NPS, and growth metrics',
    blockRefs: ['cb-2', 'cb-6', 'cb-11', 'cb-3', 'cb-13'],
    pluginType: 'dashboard',
  },
];

// ──────────────────────────────────────────────
// Search & Query Functions
// ──────────────────────────────────────────────

/** Simple keyword-based search (in production: pgvector semantic search) */
export function searchContent(query: string, blockType?: string, limit = 20): ContentBlock[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  let results = contentBlocks;

  if (blockType) {
    results = results.filter(b => b.blockType === blockType);
  }

  // Score by keyword matches in title, tags, and content
  const scored = results.map(block => {
    let score = 0;
    const searchText = [
      block.title,
      block.tags.join(' '),
      block.blockType,
      JSON.stringify(block.content),
    ].join(' ').toLowerCase();

    for (const term of terms) {
      if (searchText.includes(term)) score++;
      // Boost exact title matches
      if (block.title.toLowerCase().includes(term)) score += 2;
      // Boost tag matches
      if (block.tags.some(t => t.includes(term))) score += 1.5;
    }

    return { block, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.block);
}

/** Get a page template by slug */
export function getPage(slug: string): { template: PageTemplate; blocks: ContentBlock[] } | null {
  const template = pageTemplates.find(p => p.slug === slug);
  if (!template) return null;

  const blocks = template.blockRefs
    .map(ref => contentBlocks.find(b => b.id === ref))
    .filter((b): b is ContentBlock => b !== undefined);

  return { template, blocks };
}

/** List all available page templates */
export function listPages(): PageTemplate[] {
  return pageTemplates;
}

/** Get content blocks by IDs */
export function getBlocks(ids: string[]): ContentBlock[] {
  return ids
    .map(id => contentBlocks.find(b => b.id === id))
    .filter((b): b is ContentBlock => b !== undefined);
}

/** List available block types */
export function listBlockTypes(): string[] {
  const types = new Set(contentBlocks.map(b => b.blockType));
  return Array.from(types);
}
