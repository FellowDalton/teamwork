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
}, onChunk: (text: string) => void): Promise<string> {
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
// MCP SERVER: Teamwork Tools
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
    
    // Log time to a task
    tool(
      'log_time',
      'Log time to a task. Returns the created time entry.',
      {
        taskId: z.union([z.number(), z.string()]).describe('The task ID to log time to'),
        hours: z.union([z.number(), z.string()]).describe('Number of hours to log'),
        description: z.string().describe('Description of work done'),
        date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
      },
      async ({ taskId, hours, description, date }) => {
        try {
          const numericTaskId = Number(taskId);
          const numericHours = Number(hours);
          const logDate = date || new Date().toISOString().split('T')[0];
          const minutes = Math.round(numericHours * 60);
          
          const result = await teamwork.timeEntries.create(numericTaskId, {
            description,
            minutes,
            date: logDate,
            isBillable: true,
          });
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                timeEntryId: result.id,
                taskId,
                hours,
                minutes,
                description,
                date: logDate,
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `Error logging time: ${err}` }],
            isError: true,
          };
        }
      }
    ),
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

  // For non-status modes, use MCP-based flow (timelog needs interactive tool use)
  if (mode === 'timelog') {
    return handleTimelogChat(body);
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
        const chatPromise = runChatAgent(agentContext, (chunk) => {
          safeEnqueue(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`);
        });
        
        // Wait for both to complete
        const [vizSpecs, chatResult] = await Promise.all([vizPromise, chatPromise]);
        
        console.log('Chat Agent completed:', chatResult?.length || 0, 'chars');
        console.log('Viz Agent returned:', vizSpecs ? `${vizSpecs.length} visualizations` : 'null');
        
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
                // Stream thinking status but don't send raw text yet
                const thinkingPreview = delta.text.slice(0, 100);
                if (!thinkingPreview.includes('{') && !thinkingPreview.includes('```')) {
                  safeEnqueue(`data: ${JSON.stringify({ type: 'thinking', thinking: thinkingPreview })}\n\n`);
                }
              }
            }
          } else if (event.type === 'result' && event.subtype === 'success') {
            fullText = event.result || fullText;
          }
        }
        
        console.log('Timelog agent response length:', fullText.length);
        
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
