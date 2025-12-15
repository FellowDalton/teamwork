/**
 * Backend server for Teamwork Frontend - Agent SDK Version
 * 
 * Architecture: Data-first parallel agents
 * 1. Parse user question to understand data needs
 * 2. Fetch data directly from Teamwork API
 * 3. Run Chat Agent and Viz Agent IN PARALLEL with same data
 * 4. Stream both responses to frontend
 */

// CRITICAL: Load environment FIRST before any SDK imports
// SDK reads CLAUDE_CODE_OAUTH_TOKEN on import to determine auth method
const rootEnvPath = '../../.env';
const envFile = Bun.file(rootEnvPath);
if (await envFile.exists()) {
  const envContent = await envFile.text();
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1);
        process.env[key] = value;
      }
    }
  }
}

// Force SDK to use OAuth token by unsetting API key
// (SDK prefers API key over OAuth when both are set)
// Create a clean env object without ANTHROPIC_API_KEY
const cleanEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (key !== 'ANTHROPIC_API_KEY' && value !== undefined) {
    cleanEnv[key] = value;
  }
}
if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  console.log('Using OAuth token for Claude Max subscription');
  console.log('Clean env has ANTHROPIC_API_KEY:', !!cleanEnv.ANTHROPIC_API_KEY);
} else {
  console.log('No OAuth token found, using API key');
}

// Dynamic imports AFTER env is loaded
const { query, tool, createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk');
type Options = import('@anthropic-ai/claude-agent-sdk').Options;
const { createTeamworkClient } = await import('../teamwork_api_client/src/index.ts');
const { z } = await import('zod');

// ============================================================================
// DATE PARSING - Extract date ranges from natural language
// ============================================================================

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

function parseDateRange(question: string): DateRange {
  const today = new Date();
  const q = question.toLowerCase();
  
  // Default to last 30 days
  let startDate = new Date(today);
  let endDate = new Date(today);
  let label = 'Last 30 days';
  
  // Parse months
  const monthMatch = q.match(/last\s+(\d+)\s+months?/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1]);
    startDate.setMonth(today.getMonth() - months);
    label = `Last ${months} month${months > 1 ? 's' : ''}`;
  }
  // Parse weeks
  else if (q.match(/last\s+(\d+)\s+weeks?/)) {
    const weeks = parseInt(q.match(/last\s+(\d+)\s+weeks?/)![1]);
    startDate.setDate(today.getDate() - (weeks * 7));
    label = `Last ${weeks} week${weeks > 1 ? 's' : ''}`;
  }
  // Parse days
  else if (q.match(/last\s+(\d+)\s+days?/)) {
    const days = parseInt(q.match(/last\s+(\d+)\s+days?/)![1]);
    startDate.setDate(today.getDate() - days);
    label = `Last ${days} day${days > 1 ? 's' : ''}`;
  }
  // This week
  else if (q.includes('this week')) {
    const dayOfWeek = today.getDay();
    startDate.setDate(today.getDate() - dayOfWeek);
    label = 'This week';
  }
  // This month
  else if (q.includes('this month')) {
    startDate.setDate(1);
    label = 'This month';
  }
  // Last week
  else if (q.includes('last week')) {
    const dayOfWeek = today.getDay();
    startDate.setDate(today.getDate() - dayOfWeek - 7);
    endDate.setDate(today.getDate() - dayOfWeek - 1);
    label = 'Last week';
  }
  // Today
  else if (q.includes('today')) {
    label = 'Today';
  }
  // Yesterday
  else if (q.includes('yesterday')) {
    startDate.setDate(today.getDate() - 1);
    endDate.setDate(today.getDate() - 1);
    label = 'Yesterday';
  }
  // December, January, etc.
  else if (q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/)) {
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.findIndex(m => q.includes(m));
    if (monthIndex >= 0) {
      startDate = new Date(today.getFullYear(), monthIndex, 1);
      endDate = new Date(today.getFullYear(), monthIndex + 1, 0);
      label = monthNames[monthIndex].charAt(0).toUpperCase() + monthNames[monthIndex].slice(1);
    }
  }
  // Default: last 30 days
  else {
    startDate.setDate(today.getDate() - 30);
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    label,
  };
}

// ============================================================================
// VISUALIZATION AGENT - Decides how to display data (runs in parallel with chat)
// ============================================================================

async function runVisualizationAgent(context: {
  question: string;
  data: any;
  periodLabel: string;
}): Promise<any | null> {
  const vizSystemPrompt = `You are a visualization expert. Given a question and time tracking data, output the BEST visualization(s) to answer it.

You can output MULTIPLE visualizations if appropriate. Output a JSON array of visualizations.

VISUALIZATION TYPES:

1. Summary (for totals/aggregates):
{ "type": "summary", "title": "...", "metrics": [{ "label": "Total Hours", "value": "278.5h", "emphasis": true }] }

2. Cards (for activity lists/"what did I work on"):
{ "type": "cards", "title": "...", "items": [{ "id": "1", "date": "2024-12-06", "taskName": "...", "projectName": "...", "hours": 2.5 }], "summary": { "totalHours": 45.5, "totalEntries": 12, "totalTasks": 5 } }

3. Bar Chart (for breakdowns/comparisons):
{ "type": "chart", "chartType": "bar", "title": "Hours by Month", "data": [{ "label": "Dec", "value": 20.5 }], "summary": { "total": 45.5, "average": 5.6 } }

4. Line Chart (for trends over time):
{ "type": "chart", "chartType": "line", "title": "Hours Trend", "data": [{ "label": "Week 1", "value": 20.5 }], "summary": { "total": 45.5 } }

5. Pie/Donut Chart (for proportions/distributions):
{ "type": "chart", "chartType": "pie", "title": "Hours by Project", "data": [{ "label": "Project A", "value": 20.5 }], "summary": { "total": 45.5 } }

6. Custom SVG (for ANY custom visualization the user requests):
{ "type": "custom", "title": "My Custom Viz", "svg": "<svg viewBox='0 0 200 100'>...</svg>", "description": "Brief description" }
Use this when the user asks for something creative or not covered by other types. Generate valid SVG with these colors:
- Primary: #06b6d4 (cyan)
- Secondary: #22d3ee, #14b8a6
- Text: #e4e4e7
- Background: transparent
Keep SVG simple and clean. Use viewBox for responsiveness.

DECISION GUIDE:
- "how many hours" → summary + chart breakdown
- "what did I work on" → cards (recent items) + summary
- "breakdown by month/week/project" → chart + summary
- "show activity" → cards + summary
- "trend" or "over time" → line chart
- Creative/unique requests (gauge, radial, progress, heatmap, infographic, custom) → use type "custom" with generated SVG

IMPORTANT: When the user asks for something creative, unique, or not a standard bar/line/pie chart, 
use type "custom" and generate an SVG visualization. Be creative with the SVG!

OUTPUT FORMAT: Return a JSON array like: [{ visualization1 }, { visualization2 }]
Only output valid JSON, no markdown or explanation.`;

  const options: Options = {
    cwd: process.cwd() + '/../..',
    model: 'default', // Uses Claude default model (Sonnet) - OAuth requires short names
    disallowedTools: ['Bash', 'Edit', 'Write', 'MultiEdit', 'Read', 'Glob', 'Grep', 'Task', 'WebSearch', 'WebFetch', 'TodoWrite', 'NotebookEdit'],
    systemPrompt: vizSystemPrompt,
    maxTurns: 1,
    env: cleanEnv, // Pass clean env without ANTHROPIC_API_KEY to force OAuth
    pathToClaudeCodeExecutable: '/Users/dalton/.nvm/versions/node/v20.19.5/bin/claude', // Use installed CLI
  };

  try {
    let resultText = '';
    
    const prompt = `Question: "${context.question}"
Period: ${context.periodLabel}

Time Data:
${JSON.stringify(context.data, null, 2)}

Output visualization JSON array:`;

    for await (const event of query({ prompt, options })) {
      if (event.type === 'result' && event.subtype === 'success') {
        resultText = event.result || '';
      }
    }

    // Parse JSON array or object from result
    const arrayMatch = resultText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    const objMatch = resultText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return [JSON.parse(objMatch[0])]; // Wrap single object in array
    }
    return null;
  } catch (err) {
    console.error('Visualization agent error:', err);
    return null;
  }
}

// ============================================================================
// CHAT AGENT - Provides conversational response (runs in parallel with viz)
// ============================================================================

async function runChatAgent(context: {
  question: string;
  data: any;
  periodLabel: string;
  projectName?: string;
}, onChunk: (text: string) => void, onThinking?: (text: string) => void): Promise<string> {
  const chatSystemPrompt = `You are a helpful time tracking assistant. The user asked a question and data has already been fetched.

Analyze the data and provide a helpful, concise response. Be conversational but informative.
Include key insights like:
- Total hours worked
- Busiest periods
- Notable tasks or projects
- Patterns or observations

Keep responses concise (2-4 paragraphs max). Data is being visualized separately, so focus on insights, not listing every entry.`;

  const options: Options = {
    cwd: process.cwd() + '/../..',
    model: 'opus', // OAuth requires short names (opus/haiku/default)
    disallowedTools: ['Bash', 'Edit', 'Write', 'MultiEdit', 'Read', 'Glob', 'Grep', 'Task', 'WebSearch', 'WebFetch', 'TodoWrite', 'NotebookEdit'],
    systemPrompt: chatSystemPrompt,
    maxTurns: 1,
    includePartialMessages: true,
    env: cleanEnv, // Pass clean env without ANTHROPIC_API_KEY to force OAuth
    pathToClaudeCodeExecutable: '/Users/dalton/.nvm/versions/node/v20.19.5/bin/claude', // Use installed CLI (works with OAuth)
    stderr: (data: string) => console.log('Chat Agent STDERR:', data),
  };

  let fullText = '';
  
  console.log('Chat Agent starting with model:', options.model);
  console.log('ANTHROPIC_API_KEY in process.env:', !!process.env.ANTHROPIC_API_KEY);
  console.log('ANTHROPIC_API_KEY in options.env:', !!(options.env as any)?.ANTHROPIC_API_KEY);
  console.log('CLAUDE_CODE_OAUTH_TOKEN set:', !!process.env.CLAUDE_CODE_OAUTH_TOKEN);
  
  const prompt = `User question: "${context.question}"
Period: ${context.periodLabel}
${context.projectName ? `Project: ${context.projectName}` : 'All projects'}

Time Data Summary:
- Total Hours: ${context.data.totalHours}
- Total Entries: ${context.data.entryCount}
- Total Tasks: ${context.data.taskCount}
- Period: ${context.data.period.startDate} to ${context.data.period.endDate}

Sample entries (first 20):
${JSON.stringify(context.data.entries.slice(0, 20), null, 2)}

Provide a helpful analysis:`;

  try {
    for await (const event of query({ prompt, options })) {
      if (event.type === 'stream_event') {
        const streamEvent = event.event;
        if (streamEvent.type === 'content_block_delta') {
          const delta = (streamEvent as any).delta;
          if (delta?.type === 'text_delta' && delta.text) {
            fullText += delta.text;
            onChunk(delta.text);
            // Also send as thinking for accumulated display
            if (onThinking) {
              onThinking(delta.text);
            }
          }
        }
      } else if (event.type === 'result' && event.subtype === 'success') {
        if (!fullText && event.result) {
          fullText = event.result;
          onChunk(event.result);
        }
      }
    }
  } catch (err) {
    console.error('Chat agent error:', err);
    fullText = 'Sorry, I encountered an error analyzing the data.';
  }

  return fullText;
}

// Extract structured data from Main Agent's response
// Looks for JSON blocks or structured output in the response
function extractDataFromResponse(response: string): any | null {
  // Try to find JSON in the response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }
  
  // Try to find inline JSON object
  const inlineJson = response.match(/\{[\s\S]*"timeEntries"[\s\S]*\}/);
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson[0]);
    } catch {}
  }
  
  return null;
}

// Configuration (env already loaded at top of file)
const PORT = parseInt(process.env.TEAMWORK_FRONTEND_PORT || '3051');
const TEAMWORK_API_URL = process.env.TEAMWORK_API_URL;
const TEAMWORK_BEARER_TOKEN = process.env.TEAMWORK_BEARER_TOKEN;
const DEFAULT_PROJECT_ID = parseInt(process.env.TEAMWORK_PROJECT_ID || '0');

// Allowed project IDs
const ALLOWED_PROJECTS = [
  { id: 805682, name: 'AI workflow test' },
  { id: 804926, name: 'KiroViden - Klyngeplatform' },
];

// Initialize Teamwork client
if (!TEAMWORK_API_URL || !TEAMWORK_BEARER_TOKEN) {
  console.error('Missing required environment variables: TEAMWORK_API_URL, TEAMWORK_BEARER_TOKEN');
  process.exit(1);
}

const teamwork = createTeamworkClient({
  apiUrl: TEAMWORK_API_URL,
  bearerToken: TEAMWORK_BEARER_TOKEN,
});

// ============================================================================
// SAFETY ARCHITECTURE: Read-Only MCP Tools
// ============================================================================
// 
// CRITICAL: This MCP server contains ONLY read-only tools. Write operations
// (creating time entries, projects, tasks) are intentionally EXCLUDED.
//
// Why: To prevent the AI from making changes to Teamwork without user review.
//
// How it works:
// 1. Chat agents can ONLY use read tools (get_time_entries, search_tasks, etc.)
// 2. Agents output draft JSON (timelog_draft, project_draft) for user review
// 3. Users review drafts in the UI and click Submit/Create
// 4. Separate submit endpoints (/api/agent/timelog/submit, /api/agent/project/submit)
//    handle the actual write operations
//
// BLOCKED OPERATIONS (not available to chat agents):
// - log_time - Use /api/agent/timelog/submit instead
// - create_project - Use /api/agent/project/submit instead  
// - create_task - Use /api/agent/task/submit instead
// - update_task - Use /api/agent/task/update instead
//
// ============================================================================

// List of blocked tool names (for validation/logging)
const BLOCKED_WRITE_TOOLS = [
  'log_time',
  'create_project', 
  'create_task',
  'update_task',
  'delete_task',
  'create_timelog',
];

// Validation helper to detect if agent is trying to use blocked operations
function validateAgentResponse(response: string): { safe: boolean; warning?: string } {
  // Check for any patterns that might indicate the agent is trying to bypass safety
  const dangerPatterns = [
    /teamwork\.timeEntries\.create/i,
    /teamwork\.projects\.create/i,
    /teamwork\.tasks\.create/i,
    /\.create\s*\(/i,
    /\.update\s*\(/i,
    /\.delete\s*\(/i,
  ];
  
  for (const pattern of dangerPatterns) {
    if (pattern.test(response)) {
      console.warn('SAFETY WARNING: Agent response contains potential write operation:', pattern.source);
      return { 
        safe: false, 
        warning: `Blocked potential write operation matching: ${pattern.source}` 
      };
    }
  }
  
  return { safe: true };
}

// ============================================================================
// MCP SERVER: Teamwork Tools (READ-ONLY)
// These tools are called directly by Claude - no code writing needed
// ============================================================================

const teamworkMcpServer = createSdkMcpServer({
  name: 'teamwork',
  tools: [
    // Simple test tool
    tool(
      'test_connection',
      'Test if the MCP server is working.',
      {},
      async () => {
        console.log('test_connection called!');
        return {
          content: [{ type: 'text', text: 'MCP server is working!' }],
        };
      }
    ),
    
    // Get time entries for a date range
    tool(
      'get_time_entries',
      'Fetch time entries for a date range. Returns total hours, entry count, and entry details.',
      {
        startDate: z.string(),
        endDate: z.string(),
        projectId: z.string().optional(),
      },
      async ({ startDate, endDate, projectId }) => {
        // Convert projectId to number if it's a string
        const numericProjectId = projectId ? Number(projectId) : undefined;
        console.log('get_time_entries called with:', { startDate, endDate, projectId: numericProjectId });
        try {
          const person = await teamwork.people.me();
          const userId = person.id;
          console.log('User ID:', userId);
          
          const response = await teamwork.timeEntries.list({
            startDate,
            endDate,
            include: ['tasks', 'projects'],
            orderBy: 'date',
            orderMode: 'desc',
            pageSize: 500,
            ...(numericProjectId ? { projectIds: [numericProjectId] } : {}),
          });
          
          // Filter to user's entries
          const myEntries = response.timelogs.filter(t => t.userId === userId);
          const totalMinutes = myEntries.reduce((sum, e) => sum + e.minutes, 0);
          const totalHours = totalMinutes / 60;
          const taskIds = new Set(myEntries.map(e => e.taskId).filter(Boolean));
          
          // Format entries for output
          const entries = myEntries.slice(0, 50).map(e => ({
            id: e.id,
            date: e.date,
            hours: e.minutes / 60,
            taskId: e.taskId,
            taskName: response.included?.tasks?.[String(e.taskId)]?.name || `Task #${e.taskId}`,
            projectName: response.included?.projects?.[String(e.projectId)]?.name || `Project #${e.projectId}`,
            description: e.description || '',
          }));
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                totalHours: Math.round(totalHours * 100) / 100,
                totalMinutes,
                entryCount: myEntries.length,
                taskCount: taskIds.size,
                period: { startDate, endDate },
                entries,
              }, null, 2),
            }],
          };
        } catch (err) {
          console.error('get_time_entries error:', err);
          return {
            content: [{ type: 'text', text: `Error fetching time entries: ${err}` }],
            isError: true,
          };
        }
      }
    ),
    
    // Get current user info
    tool(
      'get_current_user',
      'Get the currently authenticated user info (id, name, email).',
      {},
      async () => {
        try {
          const person = await teamwork.people.me();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                id: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                email: person.emailAddress,
                fullName: `${person.firstName} ${person.lastName}`,
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `Error fetching user: ${err}` }],
            isError: true,
          };
        }
      }
    ),
    
    // Get projects list
    tool(
      'get_projects',
      'Get list of available projects.',
      {},
      async () => {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(ALLOWED_PROJECTS, null, 2),
          }],
        };
      }
    ),
    
    // Get tasks for a project
    tool(
      'get_tasks_by_project',
      'Get all tasks for a specific project. Returns task id, name, description, and status.',
      {
        projectId: z.union([z.number(), z.string()]).describe('The project ID'),
      },
      async ({ projectId }) => {
        try {
          const numericProjectId = Number(projectId);
          console.log('get_tasks_by_project called with:', numericProjectId);
          
          const response = await teamwork.tasks.listByProject(numericProjectId, {
            include: ['tags'],
            pageSize: 100,
          });
          
          const tasks = response.tasks.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description || '',
            status: t.status || 'active',
            estimatedMinutes: t.estimatedMinutes || 0,
            tags: t.tags?.map((tag: any) => tag.name) || [],
          }));
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ tasks, count: tasks.length }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `Error fetching tasks: ${err}` }],
            isError: true,
          };
        }
      }
    ),
    
    // Search tasks by description
    tool(
      'search_tasks',
      'Search for tasks matching a query string. Searches task names and descriptions.',
      {
        projectId: z.union([z.number(), z.string()]).describe('The project ID to search in'),
        query: z.string().describe('Search query to match against task names and descriptions'),
      },
      async ({ projectId, query }) => {
        try {
          const numericProjectId = Number(projectId);
          console.log('search_tasks called with:', { projectId: numericProjectId, query });
          
          const response = await teamwork.tasks.listByProject(numericProjectId, {
            include: ['tags'],
            pageSize: 100,
          });
          
          const queryLower = query.toLowerCase();
          const queryTerms = queryLower.split(/\s+/);
          
          // Score and filter tasks by relevance
          const scoredTasks = response.tasks.map((t: any) => {
            const nameLower = (t.name || '').toLowerCase();
            const descLower = (t.description || '').toLowerCase();
            let score = 0;
            
            // Check each query term
            for (const term of queryTerms) {
              if (nameLower.includes(term)) score += 3;
              if (descLower.includes(term)) score += 1;
            }
            
            // Boost for exact phrase match
            if (nameLower.includes(queryLower)) score += 5;
            if (descLower.includes(queryLower)) score += 2;
            
            return { task: t, score };
          });
          
          // Filter to tasks with score > 0 and sort by score
          const matchingTasks = scoredTasks
            .filter((st: any) => st.score > 0)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 10)
            .map((st: any) => ({
              id: st.task.id,
              name: st.task.name,
              description: st.task.description || '',
              status: st.task.status || 'active',
              estimatedMinutes: st.task.estimatedMinutes || 0,
              relevanceScore: st.score,
              tags: st.task.tags?.map((tag: any) => tag.name) || [],
            }));
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                query,
                projectId: numericProjectId,
                matchCount: matchingTasks.length,
                tasks: matchingTasks,
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `Error searching tasks: ${err}` }],
            isError: true,
          };
        }
      }
    ),
    
    // SAFETY: log_time tool REMOVED from chat agent MCP server
    // Write operations are only allowed via explicit submit endpoints:
    // - /api/agent/timelog/submit (for time entries)
    // - /api/agent/project/submit (for project creation)
    // This ensures users always review changes before they're applied.
  ],
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

// ============================================================================
// AGENT CHAT HANDLER - Data-first parallel architecture
// 1. Parse question to understand data needs
// 2. Fetch data directly from Teamwork
// 3. Run Chat Agent and Viz Agent IN PARALLEL
// 4. Stream both responses to frontend
// ============================================================================

async function handleAgentChat(body: {
  message: string;
  mode?: 'status' | 'timelog' | 'project' | 'general';
  projectId?: number;
  projectName?: string;
}) {
  const { message, mode = 'general', projectId, projectName } = body;
  
  if (!message) {
    return new Response('Message is required', { status: 400, headers: corsHeaders });
  }

  // Route to specialized handlers based on mode
  if (mode === 'timelog') {
    return handleTimelogChat(body);
  }
  
  if (mode === 'project') {
    return handleProjectChat(body);
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      
      const safeEnqueue = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (e) {
            closed = true;
          }
        }
      };
      
      const safeClose = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      };
      
      try {
        console.log('=== PARALLEL AGENT FLOW ===');
        console.log('Mode:', mode, '| Message:', message.slice(0, 50));
        
        // STEP 1: Parse date range from question
        const dateRange = parseDateRange(message);
        console.log('Date range:', dateRange);
        
        safeEnqueue(`data: ${JSON.stringify({
          type: 'init',
          model: 'parallel-agents',
          info: `Fetching data for ${dateRange.label}...`,
        })}\n\n`);
        
        // STEP 2: Fetch data directly from Teamwork
        safeEnqueue(`data: ${JSON.stringify({
          type: 'thinking',
          thinking: `Fetching time entries from ${dateRange.startDate} to ${dateRange.endDate}...`,
        })}\n\n`);
        
        let timeData: any;
        try {
          const person = await teamwork.people.me();
          const userId = person.id;
          
          const response = await teamwork.timeEntries.list({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            include: ['tasks', 'projects'],
            orderBy: 'date',
            orderMode: 'desc',
            pageSize: 500,
            ...(projectId ? { projectIds: [projectId] } : {}),
          });
          
          // Filter to user's entries
          const myEntries = response.timelogs.filter(t => t.userId === userId);
          const totalMinutes = myEntries.reduce((sum, e) => sum + e.minutes, 0);
          const totalHours = totalMinutes / 60;
          const taskIds = new Set(myEntries.map(e => e.taskId).filter(Boolean));
          
          // Format entries
          const entries = myEntries.map(e => ({
            id: e.id,
            date: e.date,
            hours: Math.round((e.minutes / 60) * 100) / 100,
            taskId: e.taskId,
            taskName: response.included?.tasks?.[String(e.taskId)]?.name || `Task #${e.taskId}`,
            projectName: response.included?.projects?.[String(e.projectId)]?.name || `Project #${e.projectId}`,
            description: e.description || '',
          }));
          
          timeData = {
            totalHours: Math.round(totalHours * 100) / 100,
            totalMinutes,
            entryCount: myEntries.length,
            taskCount: taskIds.size,
            period: { startDate: dateRange.startDate, endDate: dateRange.endDate },
            entries,
          };
          
          console.log(`Fetched ${myEntries.length} entries, ${totalHours.toFixed(1)}h total`);
        } catch (err) {
          console.error('Error fetching time data:', err);
          safeEnqueue(`data: ${JSON.stringify({
            type: 'error',
            error: 'Failed to fetch time data from Teamwork',
          })}\n\n`);
          safeClose();
          return;
        }
        
        safeEnqueue(`data: ${JSON.stringify({
          type: 'thinking',
          thinking: `Found ${timeData.entryCount} entries (${timeData.totalHours}h). Running analysis...`,
        })}\n\n`);
        
        // STEP 3: Run Chat Agent and Viz Agent IN PARALLEL
        const agentContext = {
          question: message,
          data: timeData,
          periodLabel: dateRange.label,
          projectName,
        };
        
        // Start both agents simultaneously
        const vizPromise = runVisualizationAgent(agentContext);
        const chatPromise = runChatAgent(
          agentContext,
          (chunk) => {
            // Don't send text chunks - we'll send the final result at the end
          },
          (thinking) => {
            // Stream thinking for accumulated display in UI
            safeEnqueue(`data: ${JSON.stringify({ type: 'thinking', thinking })}\n\n`);
          }
        );
        
        // Wait for both to complete
        const [vizSpecs, chatResult] = await Promise.all([vizPromise, chatPromise]);
        
        console.log('Chat Agent completed:', chatResult?.length || 0, 'chars');
        console.log('Viz Agent returned:', vizSpecs ? `${vizSpecs.length} visualizations` : 'null');
        
        // SAFETY VALIDATION: Check agent response for any unsafe patterns
        const validation = validateAgentResponse(chatResult || '');
        if (!validation.safe) {
          console.error('SAFETY: Blocked unsafe status agent response:', validation.warning);
          safeEnqueue(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'Safety check failed. Please try again.' 
          })}\n\n`);
          safeClose();
          return;
        }
        
        // Send final result
        safeEnqueue(`data: ${JSON.stringify({
          type: 'result',
          text: chatResult,
          final: true,
        })}\n\n`);
        
        // Send ALL visualizations from Viz Agent
        if (vizSpecs && Array.isArray(vizSpecs)) {
          for (const spec of vizSpecs) {
            console.log('Sending visualization:', spec.type);
            safeEnqueue(`data: ${JSON.stringify({
              type: 'visualization',
              spec: spec,
            })}\n\n`);
          }
        }
        
        safeEnqueue('data: [DONE]\n\n');
        safeClose();
      } catch (err) {
        console.error('Agent error:', err);
        safeEnqueue(`data: ${JSON.stringify({
          type: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })}\n\n`);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders,
    },
  });
}

// ============================================================================
// CHART REQUEST HANDLER - Generate specific chart visualizations
// ============================================================================

async function handleChartRequest(body: {
  chartType: string;
  projectId?: number;
}) {
  const { chartType: rawChartType, projectId } = body;
  
  if (!rawChartType) {
    return new Response('Chart type is required', { status: 400, headers: corsHeaders });
  }
  
  // Parse format: "grouping:vizType" (e.g., "hours-by-week:line")
  const [chartType, vizTypeOverride] = rawChartType.split(':');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      
      const safeEnqueue = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (e) {
            closed = true;
          }
        }
      };
      
      const safeClose = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      };
      
      try {
        console.log('=== CHART REQUEST ===');
        console.log('Chart type:', chartType, '| Project:', projectId);
        
        // Get current user
        const person = await teamwork.people.me();
        const userId = person.id;
        
        // Fetch time data for the last 90 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        
        const response = await teamwork.timeEntries.list({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          include: ['tasks', 'projects'],
          orderBy: 'date',
          orderMode: 'asc',
          pageSize: 500,
          ...(projectId ? { projectIds: [projectId] } : {}),
        });
        
        // Filter to user's entries (use timelogs, not timeEntries)
        const entries = (response.timelogs || []).filter((t: any) => t.userId === userId);
        const included = response.included || {};
        console.log('Fetched', entries.length, 'entries for chart');
        
        // Generate chart based on type
        let vizSpec: any = null;
        
        if (chartType === 'hours-by-week') {
          // Group by week
          const weeklyData: Record<string, number> = {};
          for (const entry of entries) {
            const dateStr = entry.timeLogged || entry.date;
            if (!dateStr) continue;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) continue; // Skip invalid dates
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + ((entry.minutes || 0) / 60);
          }
          
          const sortedWeeks = Object.keys(weeklyData).sort();
          const total = Object.values(weeklyData).reduce((a, b) => a + b, 0);
          const count = Object.keys(weeklyData).length;
          vizSpec = {
            type: 'chart',
            chartType: 'line',
            title: 'Hours by Week',
            data: sortedWeeks.map(week => ({
              label: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: parseFloat(weeklyData[week].toFixed(1)),
            })),
            summary: {
              total: parseFloat(total.toFixed(1)),
              average: count > 0 ? parseFloat((total / count).toFixed(1)) : 0,
            },
          };
        } else if (chartType === 'hours-by-month') {
          // Group by month
          const monthlyData: Record<string, number> = {};
          for (const entry of entries) {
            const dateStr = entry.timeLogged || entry.date;
            if (!dateStr) continue;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) continue;
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + ((entry.minutes || 0) / 60);
          }
          
          const sortedMonths = Object.keys(monthlyData).sort();
          const totalM = Object.values(monthlyData).reduce((a, b) => a + b, 0);
          const countM = Object.keys(monthlyData).length;
          vizSpec = {
            type: 'chart',
            chartType: 'line',
            title: 'Hours by Month',
            data: sortedMonths.map(month => ({
              label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              value: parseFloat(monthlyData[month].toFixed(1)),
            })),
            summary: {
              total: parseFloat(totalM.toFixed(1)),
              average: countM > 0 ? parseFloat((totalM / countM).toFixed(1)) : 0,
            },
          };
        } else if (chartType === 'hours-by-task') {
          // Group by task - look up task name from included data
          const taskData: Record<string, number> = {};
          for (const entry of entries) {
            const taskName = included?.tasks?.[String(entry.taskId)]?.name || entry.description || `Task #${entry.taskId}` || 'No task';
            taskData[taskName] = (taskData[taskName] || 0) + ((entry.minutes || 0) / 60);
          }
          
          const sortedTasks = Object.entries(taskData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
          
          const totalT = Object.values(taskData).reduce((a, b) => a + b, 0);
          const countT = Object.keys(taskData).length;
          vizSpec = {
            type: 'chart',
            chartType: 'bar',
            title: 'Hours by Task (Top 10)',
            data: sortedTasks.map(([label, value]) => ({
              label,
              value: parseFloat(value.toFixed(1)),
            })),
            summary: {
              total: parseFloat(totalT.toFixed(1)),
              average: countT > 0 ? parseFloat((totalT / countT).toFixed(1)) : 0,
            },
          };
        } else if (chartType === 'hours-by-project') {
          // Group by project - look up project name from included data
          const projectData: Record<string, number> = {};
          for (const entry of entries) {
            const projName = included?.projects?.[String(entry.projectId)]?.name || `Project #${entry.projectId}` || 'No project';
            projectData[projName] = (projectData[projName] || 0) + ((entry.minutes || 0) / 60);
          }
          
          const sortedProjects = Object.entries(projectData)
            .sort((a, b) => b[1] - a[1]);
          
          const totalP = Object.values(projectData).reduce((a, b) => a + b, 0);
          const countP = Object.keys(projectData).length;
          vizSpec = {
            type: 'chart',
            chartType: 'bar',
            title: 'Hours by Project',
            data: sortedProjects.map(([label, value]) => ({
              label,
              value: parseFloat(value.toFixed(1)),
            })),
            summary: {
              total: parseFloat(totalP.toFixed(1)),
              average: countP > 0 ? parseFloat((totalP / countP).toFixed(1)) : 0,
            },
          };
        }
        
        if (vizSpec) {
          // Override chart type if specified (bar, line, card)
          if (vizTypeOverride && ['bar', 'line', 'card'].includes(vizTypeOverride)) {
            vizSpec.chartType = vizTypeOverride;
          }
          safeEnqueue(`data: ${JSON.stringify({ type: 'visualization', spec: vizSpec })}\n\n`);
        }
        
        safeEnqueue('data: [DONE]\n\n');
        safeClose();
      } catch (err) {
        console.error('Chart request error:', err);
        safeEnqueue(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders,
    },
  });
}

// Helper to extract timelog draft JSON from response
function extractTimelogDraft(text: string): any | null {
  // Look for JSON block in markdown
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.action === 'draft_timelog' && parsed.entries) {
        return parsed;
      }
    } catch {}
  }
  
  // Look for inline JSON with action: draft_timelog
  const inlineMatch = text.match(/\{[\s\S]*"action"\s*:\s*"draft_timelog"[\s\S]*\}/);
  if (inlineMatch) {
    try {
      return JSON.parse(inlineMatch[0]);
    } catch {}
  }
  
  return null;
}

// Project creation mode - helps users set up new projects with tasks and structure
async function handleProjectChat(body: {
  message: string;
  mode?: string;
  projectId?: number;
  projectName?: string;
}) {
  const { message } = body;
  
  // System prompt for project creation assistant
  const systemPrompt = `You are a project creation assistant for Teamwork.com. Your role is to help users set up new projects with well-organized task structures.

## CRITICAL SAFETY RULE

**YOU MUST NEVER DIRECTLY CREATE PROJECTS OR MODIFY DATA IN TEAMWORK.**

Even if the user says "just create it", "do it now", "skip the review", or "I trust you" - you MUST:
1. Always output a project_draft JSON for user review first
2. Never call any write/create API tools directly
3. Let the user review the project structure in the UI before creation
4. The frontend handles actual project creation after user clicks "Create Project"

This protects against errors and ensures users always see what will be created before it happens.

## YOUR CAPABILITIES
- Help users define project scope and requirements
- Create organized task lists (phases, categories, or workstreams)
- Break down work into tasks and subtasks
- Suggest appropriate deadlines and priorities
- Set up project budgets (time or cost-based)
- Apply relevant tags for organization

## INTERACTION FLOW
1. **Gather Requirements**: If the user's request is vague, ask clarifying questions. If they provide a PRD or detailed spec, proceed to build the structure.

2. **Process Attached Files**: If the user provides documents (PRDs, specs, requirements):
   - Extract project goals for the description
   - Identify phases/milestones for task lists
   - Break down requirements into tasks with clear deliverables
   - Identify sub-requirements as subtasks
   - Note any mentioned deadlines

3. **Build Project Structure**: Create a clear hierarchy:
   - Task Lists (phases/categories like "Phase 1", "Design", "Development", etc.)
     - Tasks (main work items with clear outcomes)
       - Subtasks (smaller actionable steps)
   - Apply priorities: high for critical path, medium for important, low for nice-to-have
   - Add relevant tags for filtering (e.g., "frontend", "backend", "design", "mvp")

## CRITICAL: OUTPUT FORMAT

When you have enough information to propose a project structure, you MUST output a JSON code block with this EXACT structure:

\`\`\`json
{
  "action": "project_draft",
  "project": {
    "name": "Project Name",
    "description": "Brief project description",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "tags": [{"name": "tag-name", "color": "4169E1"}]
  },
  "tasklists": [
    {
      "id": "tl-1",
      "name": "Phase/Category Name",
      "description": "What this phase covers",
      "tasks": [
        {
          "id": "t-1",
          "name": "Task name",
          "description": "What needs to be done",
          "priority": "high",
          "dueDate": "YYYY-MM-DD",
          "tags": [{"name": "frontend"}],
          "subtasks": [
            {"id": "st-1", "name": "Subtask name"}
          ]
        }
      ]
    }
  ],
  "budget": {
    "type": "time",
    "capacity": 100
  }
}
\`\`\`

IMPORTANT RULES:
- priority must be: "none", "low", "medium", or "high"
- Dates must be YYYY-MM-DD format
- Generate unique IDs like "tl-1", "t-1", "st-1" for tasklists, tasks, subtasks
- Tag colors are optional hex codes without #
- After the JSON block, add a brief summary asking if the user wants to modify anything

## CURRENT CONTEXT
- Today's date: ${new Date().toISOString().split('T')[0]}

If the user provides a PRD or detailed requirements, analyze them and output the project structure JSON immediately. For vague requests, ask clarifying questions first.`;

  const options: Options = {
    cwd: process.cwd() + '/../..',
    model: 'opus',
    mcpServers: { teamwork: teamworkMcpServer },
    disallowedTools: ['Bash', 'Edit', 'Write', 'MultiEdit', 'Read', 'Glob', 'Grep', 'Task', 'WebSearch', 'WebFetch', 'TodoWrite', 'NotebookEdit'],
    systemPrompt,
    includePartialMessages: true,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    maxTurns: 10,
    env: cleanEnv,
    pathToClaudeCodeExecutable: '/Users/dalton/.nvm/versions/node/v20.19.5/bin/claude',
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let fullText = '';
      
      const safeEnqueue = (data: string) => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(data)); } catch { closed = true; }
        }
      };
      
      const safeClose = () => {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      };
      
      try {
        console.log('=== PROJECT CREATION AGENT ===');
        console.log('Message:', message.slice(0, 200));
        
        safeEnqueue(`data: ${JSON.stringify({
          type: 'init',
          model: 'project-agent',
          info: 'Analyzing your project requirements...',
        })}\n\n`);
        
        for await (const event of query({ prompt: message, options })) {
          if (event.type === 'stream_event') {
            const streamEvent = event.event;
            if (streamEvent.type === 'content_block_delta') {
              const delta = (streamEvent as any).delta;
              if (delta?.type === 'text_delta' && delta.text) {
                fullText += delta.text;
                safeEnqueue(`data: ${JSON.stringify({
                  type: 'thinking',
                  thinking: delta.text,
                })}\n\n`);
              }
            }
          } else if (event.type === 'result') {
            fullText = (event as any).result || fullText;
          }
        }
        
        // SAFETY VALIDATION: Check agent response for any unsafe patterns
        const validation = validateAgentResponse(fullText);
        if (!validation.safe) {
          console.error('SAFETY: Blocked unsafe project agent response:', validation.warning);
          safeEnqueue(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'Safety check failed. Please try again.' 
          })}\n\n`);
          safeClose();
          return;
        }
        
        // Try to extract project draft JSON from response
        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const projectData = JSON.parse(jsonMatch[1]);
            if (projectData.action === 'project_draft' && projectData.project && projectData.tasklists) {
              // Calculate summary stats
              let totalTasks = 0;
              let totalSubtasks = 0;
              for (const tl of projectData.tasklists) {
                totalTasks += tl.tasks?.length || 0;
                for (const task of tl.tasks || []) {
                  totalSubtasks += task.subtasks?.length || 0;
                }
              }
              
              // Remove the JSON block from text for clean message
              const messageText = fullText
                .replace(/```json[\s\S]*?```/, '')
                .trim();
              
              // Emit project draft event
              safeEnqueue(`data: ${JSON.stringify({
                type: 'project_draft',
                draft: {
                  project: {
                    name: projectData.project.name,
                    description: projectData.project.description,
                    startDate: projectData.project.startDate,
                    endDate: projectData.project.endDate,
                    tags: projectData.project.tags || [],
                  },
                  tasklists: projectData.tasklists.map((tl: any) => ({
                    id: tl.id,
                    name: tl.name,
                    description: tl.description,
                    tasks: (tl.tasks || []).map((t: any) => ({
                      id: t.id,
                      name: t.name,
                      description: t.description,
                      priority: t.priority || 'none',
                      dueDate: t.dueDate,
                      startDate: t.startDate,
                      estimatedMinutes: t.estimatedMinutes,
                      tags: t.tags || [],
                      subtasks: (t.subtasks || []).map((st: any) => ({
                        id: st.id,
                        name: st.name,
                        description: st.description,
                        dueDate: st.dueDate,
                      })),
                    })),
                  })),
                  budget: projectData.budget,
                  summary: {
                    totalTasklists: projectData.tasklists.length,
                    totalTasks,
                    totalSubtasks,
                  },
                  message: messageText,
                  isDraft: true,
                },
              })}\n\n`);
              
              // Send clean text result (without JSON block)
              safeEnqueue(`data: ${JSON.stringify({
                type: 'result',
                text: messageText,
              })}\n\n`);
              
              safeEnqueue('data: [DONE]\n\n');
              safeClose();
              return;
            }
          } catch (parseErr) {
            console.error('Failed to parse project JSON:', parseErr);
          }
        }
        
        // No valid project draft found, send as regular text
        safeEnqueue(`data: ${JSON.stringify({
          type: 'result',
          text: fullText,
        })}\n\n`);
        
        safeEnqueue('data: [DONE]\n\n');
        safeClose();
        
      } catch (error) {
        console.error('Project agent error:', error);
        safeEnqueue(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Timelog mode - uses timelog agent with MCP tools for intelligent time logging
async function handleTimelogChat(body: {
  message: string;
  mode?: string;
  projectId?: number;
  projectName?: string;
}) {
  const { message, projectId, projectName } = body;
  
  // Load the timelog agent prompt
  const promptPath = `${process.cwd()}/../../prompts/agents/timelog-agent.txt`;
  let systemPrompt: string;
  try {
    const promptFile = Bun.file(promptPath);
    systemPrompt = await promptFile.text();
  } catch {
    systemPrompt = 'You are a time logging assistant for Teamwork.com. Help users log their billable hours.';
  }
  
  // Add context to the system prompt
  const contextAddition = `

## CURRENT CONTEXT
- Today's date: ${new Date().toISOString().split('T')[0]}
- Available projects: ${JSON.stringify(ALLOWED_PROJECTS)}
${projectId ? `- Selected project: ${projectName} (ID: ${projectId})` : '- No project selected - ask user which project to use'}
`;
  
  systemPrompt += contextAddition;

  const options: Options = {
    cwd: process.cwd() + '/../..',
    model: 'opus',
    mcpServers: { teamwork: teamworkMcpServer },
    disallowedTools: ['Bash', 'Edit', 'Write', 'MultiEdit', 'Read', 'Glob', 'Grep', 'Task', 'WebSearch', 'WebFetch', 'TodoWrite', 'NotebookEdit'],
    systemPrompt,
    includePartialMessages: true,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    maxTurns: 8,
    env: cleanEnv,
    pathToClaudeCodeExecutable: '/Users/dalton/.nvm/versions/node/v20.19.5/bin/claude',
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let fullText = '';
      
      const safeEnqueue = (data: string) => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(data)); } catch { closed = true; }
        }
      };
      
      const safeClose = () => {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      };
      
      try {
        console.log('=== TIMELOG AGENT ===');
        console.log('Message:', message.slice(0, 100));
        console.log('Project:', projectId, projectName);
        
        safeEnqueue(`data: ${JSON.stringify({
          type: 'init',
          model: 'timelog-agent',
          info: 'Processing your time logging request...',
        })}\n\n`);
        
        for await (const event of query({ prompt: message, options })) {
          if (event.type === 'stream_event') {
            const streamEvent = event.event;
            if (streamEvent.type === 'content_block_delta') {
              const delta = (streamEvent as any).delta;
              if (delta?.type === 'text_delta' && delta.text) {
                fullText += delta.text;
                // Stream thinking status but filter out JSON data
                const chunk = delta.text;
                // Skip chunks that look like JSON or code blocks
                const isJson = chunk.includes('{') || chunk.includes('}') || 
                               chunk.includes('```') || chunk.includes('"action"') ||
                               chunk.includes('"entries"') || chunk.includes('"taskId"');
                if (!isJson && chunk.trim().length > 0) {
                  safeEnqueue(`data: ${JSON.stringify({ type: 'thinking', thinking: chunk })}\n\n`);
                }
              }
            }
          } else if (event.type === 'result' && event.subtype === 'success') {
            fullText = event.result || fullText;
          }
        }
        
        console.log('Timelog agent response length:', fullText.length);
        
        // SAFETY VALIDATION: Check agent response for any unsafe patterns
        const validation = validateAgentResponse(fullText);
        if (!validation.safe) {
          console.error('SAFETY: Blocked unsafe agent response:', validation.warning);
          safeEnqueue(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'Safety check failed. Please try again.' 
          })}\n\n`);
          safeClose();
          return;
        }
        
        // Check if response contains a timelog draft
        const draft = extractTimelogDraft(fullText);
        
        if (draft && draft.entries && draft.entries.length > 0) {
          console.log('Found timelog draft with', draft.entries.length, 'entries');
          
          // Send the draft entries to the frontend
          safeEnqueue(`data: ${JSON.stringify({
            type: 'timelog_draft',
            draft: {
              entries: draft.entries.map((e: any, idx: number) => ({
                id: `draft-${idx}-${Date.now()}`,
                taskId: e.taskId,
                taskName: e.taskName,
                projectId: e.projectId || projectId,
                projectName: e.projectName || projectName,
                hours: e.hours,
                date: e.date,
                comment: e.comment,
                confidence: e.confidence || 0.8,
                isBillable: true,
              })),
              summary: draft.summary || {
                totalHours: draft.entries.reduce((sum: number, e: any) => sum + e.hours, 0),
                totalEntries: draft.entries.length,
                dateRange: draft.entries.map((e: any) => e.date).join(', '),
              },
              message: draft.message || 'Review the entries below and click Submit to log your time.',
            },
          })}\n\n`);
          
          // Send a clean text message without the JSON
          const cleanMessage = draft.message || 'I\'ve prepared your time entries. Review them in the panel and adjust if needed, then confirm to submit.';
          safeEnqueue(`data: ${JSON.stringify({ type: 'result', text: cleanMessage, final: true })}\n\n`);
        } else {
          // No draft found - send the full text response
          // Remove any partial JSON that might have appeared
          const cleanText = fullText.replace(/```json[\s\S]*?```/g, '').trim() || fullText;
          safeEnqueue(`data: ${JSON.stringify({ type: 'result', text: cleanText, final: true })}\n\n`);
        }
        
        safeEnqueue('data: [DONE]\n\n');
        safeClose();
      } catch (err) {
        console.error('Timelog agent error:', err);
        safeEnqueue(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...corsHeaders },
  });
}

// Submit project (called when user confirms project draft)
async function handleProjectSubmit(body: {
  project: {
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    tags?: Array<{ name: string; color?: string }>;
  };
  tasklists: Array<{
    name: string;
    description?: string;
    tasks: Array<{
      name: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      tags?: Array<{ name: string }>;
      subtasks?: Array<{ name: string; description?: string }>;
    }>;
  }>;
  budget?: {
    type: 'time' | 'money';
    capacity: number;
  };
}) {
  const { project, tasklists, budget } = body;
  
  if (!project?.name) {
    return jsonResponse({ error: 'Project name is required' }, 400);
  }
  
  try {
    // 1. Create the project
    console.log('Creating project with options:', {
      name: project.name,
      description: project.description,
      startDate: project.startDate?.replace(/-/g, ''),
      endDate: project.endDate?.replace(/-/g, ''),
    });
    
    const projectResult = await teamwork.projects.create({
      name: project.name,
      description: project.description,
      startDate: project.startDate?.replace(/-/g, ''),
      endDate: project.endDate?.replace(/-/g, ''),
    });
    
    console.log('Project creation result:', projectResult);
    
    if (!projectResult?.id) {
      throw new Error('Project creation failed - no ID returned');
    }
    
    const projectId = parseInt(projectResult.id, 10);
    console.log(`Created project: ${projectId} - ${project.name}`);
    
    let totalTasksCreated = 0;
    let totalSubtasksCreated = 0;
    
    // 2. Create task lists and tasks
    for (const tasklist of (tasklists || [])) {
      const tasklistResult = await teamwork.projects.createTasklist(projectId, {
        name: tasklist.name,
        description: tasklist.description,
      });
      
      const tasklistId = parseInt(tasklistResult.id, 10);
      console.log(`Created tasklist: ${tasklistId} - ${tasklist.name}`);
      
      // 3. Create tasks in each list
      for (const task of tasklist.tasks || []) {
        try {
          console.log(`Creating task: ${task.name} with dueDate: ${task.dueDate}, priority: ${task.priority}`);
          
          const createdTask = await teamwork.tasks.create(tasklistId, {
            name: task.name,
            description: task.description,
            priority: (task.priority === 'none' ? undefined : task.priority) as any,
            dueDate: task.dueDate,
            startDate: task.startDate,
          });
          
          totalTasksCreated++;
          console.log(`Created task: ${createdTask.id} - ${task.name}`);
        
          // 4. Create subtasks
          for (const subtask of task.subtasks || []) {
            try {
              await teamwork.http.post(
                `/projects/api/v3/tasks/${createdTask.id}/subtasks.json`,
                {
                  task: {
                    name: subtask.name,
                    description: subtask.description,
                  }
                }
              );
              totalSubtasksCreated++;
            } catch (err) {
              console.error(`Failed to create subtask: ${subtask.name}`, err);
            }
          }
        } catch (err: any) {
          console.error(`Failed to create task: ${task.name}`);
          console.error('Error details:', err?.body || err?.message || err);
          // Continue with other tasks even if one fails
        }
      }
    }
    
    const tasklistCount = tasklists?.length || 0;
    return jsonResponse({
      success: true,
      projectId,
      projectName: project.name,
      projectUrl: `${TEAMWORK_API_URL}/app/projects/${projectId}`,
      summary: {
        tasklistsCreated: tasklistCount,
        tasksCreated: totalTasksCreated,
        subtasksCreated: totalSubtasksCreated,
      },
      message: `Successfully created project "${project.name}" with ${tasklistCount} task lists and ${totalTasksCreated} tasks.`,
    });
  } catch (err) {
    console.error('Project creation error:', err);
    return jsonResponse({ 
      error: err instanceof Error ? err.message : 'Failed to create project',
      success: false,
    }, 500);
  }
}

// Submit timelog entries (called when user confirms draft)
async function handleTimelogSubmit(body: {
  entries: Array<{
    taskId: number;
    hours: number;
    date: string;
    comment: string;
  }>;
}) {
  const { entries } = body;
  
  if (!entries || entries.length === 0) {
    return jsonResponse({ error: 'No entries to submit' }, 400);
  }
  
  const results: Array<{ success: boolean; taskId: number; error?: string }> = [];
  
  for (const entry of entries) {
    try {
      const minutes = Math.round(entry.hours * 60);
      await teamwork.timeEntries.create(entry.taskId, {
        description: entry.comment,
        minutes,
        date: entry.date,
        isBillable: true,
      });
      results.push({ success: true, taskId: entry.taskId });
    } catch (err) {
      results.push({ 
        success: false, 
        taskId: entry.taskId, 
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  
  return jsonResponse({
    success: successCount === entries.length,
    submitted: successCount,
    total: entries.length,
    totalHours,
    results,
    message: successCount === entries.length 
      ? `Successfully logged ${totalHours.toFixed(1)} hours across ${successCount} entries.`
      : `Logged ${successCount} of ${entries.length} entries. Some entries failed.`,
  });
}

// ============================================================================
// AI VISUALIZATION REQUEST HANDLER - Use AI to create custom visualizations
// ============================================================================
async function handleVisualizeRequest(body: {
  prompt: string;
  projectId?: number;
}) {
  const { prompt, projectId } = body;
  
  if (!prompt) {
    return new Response('Prompt is required', { status: 400, headers: corsHeaders });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      
      const safeEnqueue = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (e) {
            closed = true;
          }
        }
      };
      
      const safeClose = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      };

      try {
        console.log('=== AI VISUALIZATION REQUEST ===');
        console.log('Prompt:', prompt);
        console.log('Project:', projectId);

        // Get current user
        const person = await teamwork.people.me();
        const userId = person.id;

        // Parse date range from prompt
        const dateRange = parseDateRange(prompt);

        // Fetch time data
        const response = await teamwork.timeEntries.list({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          include: ['tasks', 'projects'],
          orderBy: 'date',
          orderMode: 'asc',
          pageSize: 500,
          ...(projectId ? { projectIds: [projectId] } : {}),
        });

        const entries = (response.timelogs || []).filter((t: any) => t.userId === userId);
        const included = response.included || {};
        
        // Build time data structure for AI
        const timeData = {
          entryCount: entries.length,
          totalHours: entries.reduce((sum: number, e: any) => sum + (e.minutes || 0) / 60, 0),
          entries: entries.map((e: any) => ({
            date: e.timeLogged || e.date,
            hours: (e.minutes || 0) / 60,
            taskName: included?.tasks?.[String(e.taskId)]?.name || `Task #${e.taskId}`,
            projectName: included?.projects?.[String(e.projectId)]?.name || `Project #${e.projectId}`,
            description: e.description,
          })),
        };
        
        console.log('Fetched', entries.length, 'entries, sending to AI visualization agent');

        // Use AI visualization agent to create custom visualization
        const vizSpecs = await runVisualizationAgent({
          question: prompt,
          data: timeData,
          periodLabel: dateRange.label,
        });

        // Send all visualizations
        if (vizSpecs && Array.isArray(vizSpecs)) {
          for (const spec of vizSpecs) {
            console.log('Sending AI visualization:', spec.type);
            safeEnqueue(`data: ${JSON.stringify({ type: 'visualization', spec })}\n\n`);
          }
        }
        
        safeEnqueue('data: [DONE]\n\n');
        safeClose();
      } catch (err) {
        console.error('Visualization request error:', err);
        safeEnqueue(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders,
    },
  });
}

// Simple API endpoints for direct Teamwork access
async function handleProjectsList() {
  // Wrap in { projects: [...] } to match teamworkService expectations
  return jsonResponse({ projects: ALLOWED_PROJECTS });
}

async function handleTasksList(projectId: number) {
  try {
    const tasks = await teamwork.tasks.listByProject(projectId, {
      include: ['tags', 'assignees'],
      pageSize: 50,
    });
    return jsonResponse(tasks);
  } catch (err) {
    return errorResponse('Failed to fetch tasks');
  }
}

async function handleTimeEntriesList(projectId?: number) {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const response = await teamwork.timeEntries.list({
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      include: ['tasks', 'projects'],
      pageSize: 100,
      ...(projectId ? { projectIds: [projectId] } : {}),
    });
    return jsonResponse(response);
  } catch (err) {
    return errorResponse('Failed to fetch time entries');
  }
}

// Main request handler
const server = Bun.serve({
  port: PORT,
  idleTimeout: 255, // Max allowed - SDK with skills can take a while
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Agent SDK streaming endpoint
      if (path === '/api/agent/stream' && req.method === 'POST') {
        const body = await req.json();
        return handleAgentChat(body);
      }
      
      // Chart request endpoint
      if (path === '/api/agent/chart' && req.method === 'POST') {
        const body = await req.json();
        return handleChartRequest(body);
      }
      
      // AI Visualization request endpoint (custom prompts)
      if (path === '/api/agent/visualize' && req.method === 'POST') {
        const body = await req.json();
        return handleVisualizeRequest(body);
      }
      
      // Timelog submit endpoint (confirms and submits draft entries)
      if (path === '/api/agent/timelog/submit' && req.method === 'POST') {
        const body = await req.json();
        return handleTimelogSubmit(body);
      }
      
      // Project submit endpoint (confirms and creates project from draft)
      if (path === '/api/agent/project/submit' && req.method === 'POST') {
        const body = await req.json();
        return handleProjectSubmit(body);
      }
      
      // Teamwork API endpoints
      if (path === '/api/projects' && req.method === 'GET') {
        return handleProjectsList();
      }
      
      if (path.startsWith('/api/projects/') && path.endsWith('/tasks') && req.method === 'GET') {
        const projectId = parseInt(path.split('/')[3]);
        return handleTasksList(projectId);
      }
      
      if (path === '/api/time-entries' && req.method === 'GET') {
        const projectId = url.searchParams.get('projectId');
        return handleTimeEntriesList(projectId ? parseInt(projectId) : undefined);
      }
      
      // Health check
      if (path === '/health') {
        return jsonResponse({ status: 'ok', sdk: true });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error('Request error:', err);
      return errorResponse('Internal Server Error');
    }
  },
});

console.log(`Agent SDK server running at http://localhost:${PORT}`);
console.log(`Teamwork API: ${TEAMWORK_API_URL}`);
console.log(`Default Project ID: ${DEFAULT_PROJECT_ID}`);
console.log('');
console.log('Skills loaded from:', process.cwd() + '/../../.claude/skills/');
console.log('');
console.log('To use Max subscription, ensure CLAUDE_CODE_OAUTH_TOKEN is set:');
console.log('  1. Run: claude setup-token');
console.log('  2. Set: export CLAUDE_CODE_OAUTH_TOKEN="your-token"');
