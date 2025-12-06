/**
 * Backend server for Teamwork Frontend - Agent SDK Version
 * 
 * Uses Claude Agent SDK with skills for intelligent Teamwork interactions.
 * Skills handle date parsing, API calls, and data analysis autonomously.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { createTeamworkClient } from '../teamwork_api_client/src/index.ts';

// Visualization agent - SEQUENTIAL: receives data from Main Agent, just formats it
// No skills needed - pure formatting agent
async function runVisualizationAgent(context: {
  question: string;
  data: any; // Data already fetched by Main Agent
}): Promise<any | null> {
  const vizSystemPrompt = `You are a visualization formatter. You receive pre-fetched data and output ONLY a JSON object for visual display.

Output format (pick ONE type based on the question):

For totals/summaries ("how many hours", "total time"):
{
  "type": "summary",
  "title": "Time Summary",
  "metrics": [
    { "label": "Total Hours", "value": "278.5h", "emphasis": true },
    { "label": "Tasks", "value": "45" },
    { "label": "Entries", "value": "312" }
  ]
}

For activity lists ("what did I work on", "show activity"):
{
  "type": "cards",
  "title": "Recent Activity", 
  "items": [
    { "id": "1", "date": "2024-12-06", "taskName": "Task", "projectName": "Project", "hours": 2.5 }
  ],
  "summary": { "totalHours": 45.5, "totalEntries": 12, "totalTasks": 5 }
}

For breakdowns ("by project", "by day", "breakdown"):
{
  "type": "chart",
  "chartType": "bar",
  "title": "Hours by Project",
  "data": [{ "label": "Project A", "value": 20.5 }],
  "summary": { "total": 45.5 }
}

RULES:
- Output ONLY valid JSON, no markdown, no explanation
- Use the actual numbers from the data provided
- "how many hours" → summary type
- "what did I work on" → cards type
- "breakdown/by project" → chart type`;

  // Lightweight SDK call - no tools, just formatting
  const options: Options = {
    cwd: process.cwd() + '/../..',
    allowedTools: [], // No tools needed - just formatting
    systemPrompt: vizSystemPrompt,
    maxTurns: 1, // Single turn - just format and return
  };

  try {
    let resultText = '';
    
    const prompt = `Question: "${context.question}"

Data to visualize:
${JSON.stringify(context.data, null, 2)}

Output the appropriate visualization JSON:`;

    for await (const event of query({ prompt, options })) {
      if (event.type === 'result' && event.subtype === 'success') {
        resultText = event.result || '';
      }
    }

    // Parse JSON from result
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (err) {
    console.error('Visualization agent error:', err);
    return null;
  }
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

// Load environment from root .env
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

// Configuration
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

// Agent SDK streaming chat handler - SEQUENTIAL FLOW
// 1. Main Agent fetches data via skills, streams response
// 2. After Main Agent completes, Viz Agent formats the data (no skills)
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

  // Build context for the query - ask Main Agent to output structured data
  let systemPromptAppend = '';
  const needsVisualization = mode === 'status'; // Only status mode needs viz
  
  if (mode === 'status') {
    systemPromptAppend = `
You are helping the user check their activity status on Teamwork.com.
Use the manage-teamwork skill to get activity data and time entries.

IMPORTANT: After analyzing the data, you MUST output a JSON block with the raw data:
\`\`\`json
{
  "summary": {
    "totalHours": <number>,
    "totalEntries": <number>,
    "totalTasks": <number>,
    "period": "<period label>"
  },
  "timeEntries": [
    { "id": "<id>", "date": "<date>", "taskName": "<name>", "projectName": "<project>", "hours": <hours> }
  ]
}
\`\`\`

Then provide your conversational analysis.

Current context:
- User is asking: "${message}"
${projectId ? `- Project filter: ${projectName || projectId}` : '- No specific project filter (show all projects)'}
`;
  } else if (mode === 'timelog') {
    systemPromptAppend = `
You are helping the user log time on Teamwork.com.
Use the manage-teamwork skill to log time entries.

Current context:
- User is asking: "${message}"
${projectId ? `- Target project: ${projectName || projectId}` : ''}
`;
  } else if (mode === 'project') {
    systemPromptAppend = `
You are helping the user manage their Teamwork.com projects.
Use the manage-teamwork skill for project operations.

Current context:
- User is asking: "${message}"
${projectId ? `- Current project: ${projectName || projectId}` : ''}
`;
  }

  // SDK options for Main Agent
  const options: Options = {
    cwd: process.cwd() + '/../..', // Project root where .claude/skills/ is
    settingSources: ['project'], // Load skills from .claude/skills/
    allowedTools: [
      'Skill',  // Enable skills (most important!)
      'Read',
      'Bash',
      'Grep',
      'Glob',
    ],
    systemPrompt: systemPromptAppend ? {
      type: 'preset',
      preset: 'claude_code',
      append: systemPromptAppend,
    } : undefined,
    includePartialMessages: true, // Enable streaming
    permissionMode: 'acceptEdits', // Auto-accept for better UX
  };

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
        console.log('Starting Main Agent SDK query...');
        console.log('Mode:', mode, '| Needs visualization:', needsVisualization);
        
        let resultText = '';
        let extractedData: any = null;
        
        // STEP 1: Run Main Agent (with skills)
        for await (const event of query({ prompt: message, options })) {
          if (closed) break; // Stop if connection closed
          
          if (event.type === 'system' && event.subtype === 'init') {
            console.log('Main Agent initialized:', event.model);
            safeEnqueue(`data: ${JSON.stringify({
              type: 'init',
              model: event.model,
              tools: event.tools,
            })}\n\n`);
          }
          
          else if (event.type === 'stream_event') {
            const streamEvent = event.event;
            if (streamEvent.type === 'content_block_delta') {
              const delta = (streamEvent as any).delta;
              if (delta?.type === 'text_delta' && delta.text) {
                resultText += delta.text;
                safeEnqueue(`data: ${JSON.stringify({
                  type: 'text',
                  text: delta.text,
                })}\n\n`);
              } else if (delta?.type === 'thinking_delta' && delta.thinking) {
                safeEnqueue(`data: ${JSON.stringify({
                  type: 'thinking',
                  thinking: delta.thinking,
                })}\n\n`);
              }
            }
          }
          
          else if (event.type === 'assistant') {
            const content = event.message?.content || [];
            for (const block of content) {
              if (block.type === 'text') {
                resultText = block.text; // Capture full text
                safeEnqueue(`data: ${JSON.stringify({
                  type: 'thinking',
                  thinking: block.text.slice(0, 200) + (block.text.length > 200 ? '...' : ''),
                })}\n\n`);
              } else if (block.type === 'tool_use') {
                safeEnqueue(`data: ${JSON.stringify({
                  type: 'tool_use',
                  tool: block.name,
                  thinking: `Using: ${block.name}`,
                })}\n\n`);
              }
            }
          }
          
          else if (event.type === 'result') {
            console.log('Main Agent completed:', event.subtype);
            
            if (event.subtype === 'success') {
              const finalText = event.result || resultText;
              
              // Extract data for Viz Agent
              extractedData = extractDataFromResponse(finalText);
              
              // Remove JSON block from response for cleaner display
              const cleanText = finalText.replace(/```json[\s\S]*?```/g, '').trim();
              
              safeEnqueue(`data: ${JSON.stringify({
                type: 'result',
                text: cleanText,
                final: true,
                usage: {
                  duration_ms: event.duration_ms,
                  turns: event.num_turns,
                },
              })}\n\n`);
            } else {
              const errors = (event as any).errors || [];
              safeEnqueue(`data: ${JSON.stringify({
                type: 'error',
                error: errors.join('; ') || `Query failed: ${event.subtype}`,
              })}\n\n`);
            }
          }
        }
        
        // STEP 2: Run Viz Agent sequentially (if we have data)
        if (needsVisualization && extractedData) {
          console.log('Starting Viz Agent with extracted data...');
          safeEnqueue(`data: ${JSON.stringify({
            type: 'thinking',
            thinking: 'Formatting visualization...',
          })}\n\n`);
          
          const vizSpec = await runVisualizationAgent({
            question: message,
            data: extractedData,
          });
          
          if (vizSpec) {
            console.log('Viz Agent returned:', vizSpec.type);
            safeEnqueue(`data: ${JSON.stringify({
              type: 'visualization',
              spec: vizSpec,
            })}\n\n`);
          }
        }
        
        safeEnqueue('data: [DONE]\n\n');
        safeClose();
      } catch (err) {
        console.error('Agent SDK error:', err);
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
