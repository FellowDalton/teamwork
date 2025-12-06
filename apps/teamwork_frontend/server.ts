/**
 * Backend server for Teamwork Frontend
 * 
 * Provides API endpoints that proxy to Teamwork API and Claude API,
 * keeping credentials server-side.
 */

import { createTeamworkClient, createTaskMonitor } from '../teamwork_api_client/src/index.ts';
import { parseDisplayHints, removeDisplayHints } from './services/agentService.ts';

// Run Creative/Visualization Agent via CLI (parallel to main agent)
async function runVisualizationAgent(vizContext: {
  question: string;
  periodLabel: string;
  projectName?: string;
  timeEntries: any[];
  summary: { totalHours: string; taskCount: number; entryCount: number };
}): Promise<any | null> {
  const vizPromptPath = `${process.cwd()}/../../prompts/agents/visualization-agent.txt`;
  
  const vizInput = JSON.stringify({
    question: vizContext.question,
    period: vizContext.periodLabel,
    project: vizContext.projectName || 'All projects',
    summary: vizContext.summary,
    timeEntries: vizContext.timeEntries.slice(0, 100), // Limit for context window
  });
  
  try {
    const vizProc = Bun.spawn([
      'claude', '-p', 
      '--output-format', 'json',
      '--system-prompt-file', vizPromptPath,
      vizInput
    ], {
      cwd: process.cwd() + '/../..',
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    const output = await new Response(vizProc.stdout).text();
    await vizProc.exited;
    
    // Parse the JSON response from Claude CLI
    const lines = output.trim().split('\n');
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        // Claude CLI json format wraps result
        if (parsed.result) {
          // The result might be a string containing JSON
          const resultText = parsed.result.trim();
          // Try to parse the result as JSON
          try {
            return JSON.parse(resultText);
          } catch {
            // Result is not JSON, try to extract JSON from it
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
          }
        }
        // Direct visualization spec
        if (parsed.type && (parsed.type === 'summary' || parsed.type === 'cards' || parsed.type === 'chart')) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
    console.error('Could not parse visualization agent response');
    return null;
  } catch (err) {
    console.error('Visualization agent error:', err);
    return null;
  }
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

// Configuration from environment
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TEAMWORK_API_URL = process.env.TEAMWORK_API_URL;
const TEAMWORK_BEARER_TOKEN = process.env.TEAMWORK_BEARER_TOKEN;
const TEAMWORK_PROJECT_ID = process.env.TEAMWORK_PROJECT_ID;

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in environment');
}
if (!TEAMWORK_API_URL || !TEAMWORK_BEARER_TOKEN) {
  console.error('Missing TEAMWORK_API_URL or TEAMWORK_BEARER_TOKEN in environment');
}

// Create Teamwork client
const teamwork = createTeamworkClient({
  apiUrl: TEAMWORK_API_URL || '',
  bearerToken: TEAMWORK_BEARER_TOKEN || '',
  debug: true,
});

const taskMonitor = createTaskMonitor({
  defaultProjectId: TEAMWORK_PROJECT_ID ? parseInt(TEAMWORK_PROJECT_ID) : undefined,
});

// CORS headers for development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper to create error response
function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

// Parse URL path parameters
function getPathParam(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match?.[1] ?? null;
}

// Route handlers
async function handleGetProjects() {
  try {
    const response = await teamwork.projects.list({ status: 'active' });
    
    // TODO: Remove this filter once testing is complete - currently limiting to allowed projects only
    const ALLOWED_PROJECT_IDS = [
      805682, // "AI workflow test"
      804926, // "KiroViden - Klyngeplatform"
    ];
    const filteredProjects = response.projects.filter((p) => ALLOWED_PROJECT_IDS.includes(p.id));
    
    return jsonResponse({ projects: filteredProjects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return errorResponse('Failed to fetch projects');
  }
}

async function handleGetProject(projectId: number) {
  try {
    const project = await teamwork.projects.get(projectId);
    
    // Fetch related data with individual error handling
    let tasklists: any[] = [];
    let tasks: any[] = [];
    let stages: any[] = [];

    // Fetch tasklists
    try {
      const tasklistsResponse = await teamwork.projects.getTasklists(projectId);
      tasklists = tasklistsResponse.tasklists;
    } catch (err) {
      console.error(`Failed to fetch tasklists for project ${projectId}:`, err);
    }

    // Fetch tasks
    try {
      const tasksResponse = await teamwork.tasks.listByProject(projectId, {
        include: ['tags', 'assignees'],
        pageSize: 100,
      });
      tasks = tasksResponse.tasks;
    } catch (err) {
      console.error(`Failed to fetch tasks for project ${projectId}:`, err);
    }
    
    // Get workflow stages if project has an active workflow
    if (project.activeWorkflow?.id) {
      try {
        stages = await teamwork.workflows.getStages(project.activeWorkflow.id);
      } catch (err) {
        console.error(`Failed to fetch stages for project ${projectId}:`, err);
      }
    }

    return jsonResponse({
      project,
      tasklists,
      tasks,
      stages,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return errorResponse('Failed to fetch project');
  }
}

async function handleGetProjectTasks(projectId: number) {
  try {
    const response = await teamwork.tasks.listByProject(projectId, {
      include: ['tags', 'assignees'],
      pageSize: 100,
    });
    return jsonResponse({ tasks: response.tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return errorResponse('Failed to fetch tasks');
  }
}

async function handleGetTimeEntries(projectId?: number) {
  try {
    let response;
    if (projectId) {
      response = await teamwork.timeEntries.listByProject(projectId, {
        pageSize: 100,
        orderBy: 'date',
        orderMode: 'desc',
      });
    } else {
      response = await teamwork.timeEntries.list({
        pageSize: 100,
        orderBy: 'date',
        orderMode: 'desc',
      });
    }
    return jsonResponse({ timelogs: response.timelogs });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return errorResponse('Failed to fetch time entries');
  }
}

async function handleCreateTimeEntry(taskId: number, body: any) {
  try {
    const { hours, description, isBillable, date } = body;
    const entry = await teamwork.timeEntries.logHoursToTask(taskId, hours, {
      description: description || '',
      isBillable: isBillable !== false,
      date: date || new Date().toISOString().split('T')[0],
    });
    return jsonResponse({ timelog: entry }, 201);
  } catch (error) {
    console.error('Error creating time entry:', error);
    return errorResponse('Failed to create time entry');
  }
}

async function handleChatProxy(body: any) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return errorResponse(`Claude API error: ${response.status}`, response.status);
    }

    const data = await response.json();
    return jsonResponse(data);
  } catch (error) {
    console.error('Error proxying to Claude:', error);
    return errorResponse('Failed to process chat request');
  }
}

async function handleGetWorkflows() {
  try {
    const response = await teamwork.workflows.list({ include: ['stages'] });
    return jsonResponse({ workflows: response.workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return errorResponse('Failed to fetch workflows');
  }
}

async function handleGetWorkflowStages(workflowId: number) {
  try {
    const stages = await teamwork.workflows.getStages(workflowId);
    return jsonResponse({ stages });
  } catch (error) {
    console.error('Error fetching stages:', error);
    return errorResponse('Failed to fetch stages');
  }
}

async function handleGetCurrentUser() {
  try {
    const person = await teamwork.people.me();
    return jsonResponse({ person });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return errorResponse('Failed to fetch current user');
  }
}

async function handleGetActivity(url: URL) {
  try {
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const userIds = url.searchParams.get('userIds')?.split(',').map(Number).filter(Boolean);
    const projectIds = url.searchParams.get('projectIds')?.split(',').map(Number).filter(Boolean);
    const activityTypes = url.searchParams.get('activityTypes')?.split(',') as any;
    const pageSize = url.searchParams.get('pageSize') ? parseInt(url.searchParams.get('pageSize')!) : 50;

    const response = await teamwork.activity.list({
      startDate,
      endDate,
      userIds,
      projectIds,
      activityTypes,
      pageSize,
      orderMode: 'desc',
    });
    return jsonResponse(response);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return errorResponse('Failed to fetch activity');
  }
}

async function handleGetActivityStatus(url: URL) {
  try {
    // Get current user
    const person = await teamwork.people.me();
    const userId = person.id;
    const userName = [person.firstName, person.lastName].filter(Boolean).join(' ');

    // Parse date range from query params or default to today
    let startDate = url.searchParams.get('startDate');
    let endDate = url.searchParams.get('endDate');
    const period = url.searchParams.get('period') || 'today';
    const projectId = url.searchParams.get('projectId') ? parseInt(url.searchParams.get('projectId')!) : undefined;

    if (!startDate || !endDate) {
      const today = new Date();
      const format = (d: Date) => d.toISOString().split('T')[0];

      switch (period.toLowerCase()) {
        case 'today':
          startDate = format(today);
          endDate = format(today);
          break;
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = format(yesterday);
          endDate = format(yesterday);
          break;
        }
        case 'this week':
        case 'thisweek': {
          const monday = new Date(today);
          monday.setDate(today.getDate() - today.getDay() + 1);
          startDate = format(monday);
          endDate = format(today);
          break;
        }
        case 'last week':
        case 'lastweek': {
          const lastMonday = new Date(today);
          lastMonday.setDate(today.getDate() - today.getDay() - 6);
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          startDate = format(lastMonday);
          endDate = format(lastSunday);
          break;
        }
        case 'thismonth': {
          const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate = format(firstOfMonth);
          endDate = format(today);
          break;
        }
        case 'lastmonth': {
          const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
          startDate = format(firstOfLastMonth);
          endDate = format(lastOfLastMonth);
          break;
        }
        case 'thisyear': {
          const firstOfYear = new Date(today.getFullYear(), 0, 1);
          startDate = format(firstOfYear);
          endDate = format(today);
          break;
        }
        case 'lastyear': {
          const firstOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
          const lastOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
          startDate = format(firstOfLastYear);
          endDate = format(lastOfLastYear);
          break;
        }
        case 'last3months': {
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setMonth(today.getMonth() - 3);
          startDate = format(threeMonthsAgo);
          endDate = format(today);
          break;
        }
        case 'last6months': {
          const sixMonthsAgo = new Date(today);
          sixMonthsAgo.setMonth(today.getMonth() - 6);
          startDate = format(sixMonthsAgo);
          endDate = format(today);
          break;
        }
        case 'alltime': {
          const fiveYearsAgo = new Date(today);
          fiveYearsAgo.setFullYear(today.getFullYear() - 5);
          startDate = format(fiveYearsAgo);
          endDate = format(today);
          break;
        }
        default:
          startDate = format(today);
          endDate = format(today);
      }
    }

    // Increase page size for longer periods
    const pageSize = ['alltime', 'thisyear', 'lastyear', 'last6months', 'last3months', 'thismonth', 'lastmonth'].includes(period.toLowerCase()) ? 500 : 100;

    // Fetch time entries
    const timeResponse = await teamwork.timeEntries.list({
      startDate,
      endDate,
      include: ['tasks', 'projects'],
      orderBy: 'date',
      orderMode: 'desc',
      pageSize,
      ...(projectId ? { projectIds: [projectId] } : {}),
    });

    // Filter to only current user's entries (and optionally by project)
    let myTimeEntries = timeResponse.timelogs.filter(t => t.userId === userId);
    if (projectId) {
      myTimeEntries = myTimeEntries.filter(t => t.projectId === projectId);
    }

    // Fetch activity
    let activities: any[] = [];
    try {
      const activityResponse = await teamwork.activity.list({
        userIds: [userId],
        startDate,
        endDate,
        activityTypes: ['task', 'task_comment'],
        pageSize: 100,
        orderMode: 'desc',
        ...(projectId ? { projectIds: [projectId] } : {}),
      });
      activities = activityResponse.activities;
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    }

    // Calculate totals
    const totalMinutes = myTimeEntries.reduce((sum, e) => sum + e.minutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    // Group by project
    const timeByProject = new Map<number, { projectId: number; minutes: number }>();
    for (const entry of myTimeEntries) {
      if (entry.projectId) {
        const existing = timeByProject.get(entry.projectId) || { projectId: entry.projectId, minutes: 0 };
        existing.minutes += entry.minutes;
        timeByProject.set(entry.projectId, existing);
      }
    }

    // Unique tasks
    const tasksWorkedOn = new Set(myTimeEntries.map(e => e.taskId).filter(Boolean));

    return jsonResponse({
      user: { id: userId, name: userName },
      period: { startDate, endDate, label: period },
      summary: {
        totalMinutes,
        totalHours: parseFloat(totalHours),
        taskCount: tasksWorkedOn.size,
        entryCount: myTimeEntries.length,
      },
      timeByProject: Array.from(timeByProject.values()),
      timeEntries: myTimeEntries.slice(0, 50), // Return more entries for data cards
      activities: activities.slice(0, 20),
      included: timeResponse.included,
    });
  } catch (error) {
    console.error('Error fetching activity status:', error);
    return errorResponse('Failed to fetch activity status');
  }
}

// =============================================================================
// CLAUDE INTEGRATION
// =============================================================================
// TODO: Replace Claude CLI with Anthropic Agent SDK for production
// Currently using Claude Code CLI (`claude -p`) which requires:
// - User's Claude Code subscription (no API credits needed)
// - CLI installed and authenticated
// 
// To migrate to Agent SDK:
// 1. Install: npm install @anthropic-ai/sdk
// 2. Replace Bun.spawn() calls with sdk.messages.create()
// 3. For streaming: use sdk.messages.stream() 
// 4. Update system prompts to use SDK format
// 5. Handle tool use responses if needed
// =============================================================================

// Claude CLI chat handler (non-streaming)
async function handleClaudeChat(body: {
  message: string;
  mode?: 'status' | 'timelog' | 'project' | 'general';
}) {
  const { message, mode = 'general' } = body;
  
  if (!message) {
    return errorResponse('Message is required', 400);
  }

  try {
    // Map mode to prompt file
    const promptFile = mode === 'general' ? 'base' : mode;
    const promptPath = `${process.cwd()}/../../prompts/teamwork-cli/${promptFile}.txt`;
    
    let fullMessage = message;
    
    // For status mode, auto-fetch activity data
    if (mode === 'status') {
      // Detect period from message
      let period = 'today';
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('yesterday')) {
        period = 'yesterday';
      } else if (lowerMsg.includes('this week') || lowerMsg.includes('thisweek')) {
        period = 'thisweek';
      } else if (lowerMsg.includes('last week') || lowerMsg.includes('lastweek')) {
        period = 'lastweek';
      }
      
      // Fetch activity data
      const person = await teamwork.people.me();
      const userId = person.id;
      const userName = [person.firstName, person.lastName].filter(Boolean).join(' ');
      
      const today = new Date();
      const format = (d: Date) => d.toISOString().split('T')[0];
      let startDate: string, endDate: string;
      
      switch (period) {
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = format(yesterday);
          endDate = format(yesterday);
          break;
        }
        case 'thisweek': {
          const monday = new Date(today);
          monday.setDate(today.getDate() - today.getDay() + 1);
          startDate = format(monday);
          endDate = format(today);
          break;
        }
        case 'lastweek': {
          const lastMonday = new Date(today);
          lastMonday.setDate(today.getDate() - today.getDay() - 6);
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          startDate = format(lastMonday);
          endDate = format(lastSunday);
          break;
        }
        default:
          startDate = format(today);
          endDate = format(today);
      }
      
      const timeResponse = await teamwork.timeEntries.list({
        startDate,
        endDate,
        include: ['tasks', 'projects'],
        orderBy: 'date',
        orderMode: 'desc',
        pageSize: 100,
      });
      
      const myTimeEntries = timeResponse.timelogs.filter(t => t.userId === userId);
      const totalMinutes = myTimeEntries.reduce((sum, e) => sum + e.minutes, 0);
      
      let activities: any[] = [];
      try {
        const activityResponse = await teamwork.activity.list({
          userIds: [userId],
          startDate,
          endDate,
          activityTypes: ['task', 'task_comment'],
          pageSize: 50,
          orderMode: 'desc',
        });
        activities = activityResponse.activities;
      } catch (err) {
        console.error('Failed to fetch activity:', err);
      }
      
      const activityData = {
        user: { id: userId, name: userName },
        period: { startDate, endDate, label: period },
        summary: {
          totalMinutes,
          totalHours: (totalMinutes / 60).toFixed(1),
          taskCount: new Set(myTimeEntries.map(e => e.taskId).filter(Boolean)).size,
          entryCount: myTimeEntries.length,
        },
        timeEntries: myTimeEntries.slice(0, 10),
        activities: activities.slice(0, 10),
      };
      
      fullMessage = `User question: ${message}\n\nActivity data:\n${JSON.stringify(activityData, null, 2)}`;
    }
    
    // Spawn Claude CLI process
    const proc = Bun.spawn(['claude', '-p', '--system-prompt-file', promptPath, fullMessage], {
      cwd: process.cwd() + '/../..',
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: undefined, // Unset to use CLI subscription auth
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    
    if (exitCode !== 0) {
      console.error('Claude CLI error:', stderr);
      return errorResponse(`Claude CLI failed: ${stderr}`, 500);
    }
    
    return jsonResponse({
      response: output.trim(),
      mode,
    });
  } catch (error) {
    console.error('Error in Claude chat:', error);
    return errorResponse('Failed to process chat request');
  }
}

// Claude CLI streaming chat handler
// TODO: Replace with Agent SDK streaming - sdk.messages.stream()
// Note: Claude CLI doesn't provide true character-by-character streaming,
// it sends the full response at once. Agent SDK provides real streaming.
async function handleClaudeChatStream(body: {
  message: string;
  mode?: 'status' | 'timelog' | 'project' | 'general';
  projectId?: number;
  projectName?: string;
}) {
  const { message, mode = 'general', projectId, projectName } = body;
  
  if (!message) {
    return new Response('Message is required', { status: 400, headers: corsHeaders });
  }

  // Map mode to prompt file
  const promptFile = mode === 'general' ? 'base' : mode;
  const promptPath = `${process.cwd()}/../../prompts/teamwork-cli/${promptFile}.txt`;
  
  let fullMessage = message;
  
  // Variables to store data for CardAgent (populated in status mode)
  let storedTimeEntries: any[] = [];
  let storedPeriodLabel = '';
  let storedProjectName = projectName || '';
  
  // For status mode, fetch activity data first
  if (mode === 'status') {
    try {
      let period = 'today';
      let dynamicDays: number | null = null; // For dynamic "last N days/weeks/months" parsing
      const lowerMsg = message.toLowerCase();
      
      // Word to number mapping
      const wordToNum: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
        eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12
      };
      
      // First, try dynamic regex parsing for "last N days/weeks/months/years"
      // Supports both digits and words (e.g., "last 7 months" or "last seven months")
      const dynamicMatch = lowerMsg.match(/(?:last|past)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(days?|weeks?|months?|years?)/i);
      if (dynamicMatch) {
        const amountStr = dynamicMatch[1].toLowerCase();
        const amount = wordToNum[amountStr] ?? parseInt(amountStr);
        const unit = dynamicMatch[2].toLowerCase();
        // Calculate days based on unit
        if (unit.startsWith('day')) {
          dynamicDays = amount;
        } else if (unit.startsWith('week')) {
          dynamicDays = amount * 7;
        } else if (unit.startsWith('month')) {
          dynamicDays = amount * 30; // Approximate
        } else if (unit.startsWith('year')) {
          dynamicDays = amount * 365;
        }
        period = 'dynamic';
      } else if (lowerMsg.includes('yesterday')) {
        period = 'yesterday';
      } else if (lowerMsg.includes('this week') || lowerMsg.includes('thisweek')) {
        period = 'thisweek';
      } else if (lowerMsg.includes('last week') || lowerMsg.includes('lastweek')) {
        period = 'lastweek';
      } else if (lowerMsg.includes('this month') || lowerMsg.includes('thismonth')) {
        period = 'thismonth';
      } else if (lowerMsg.includes('last month') || lowerMsg.includes('lastmonth')) {
        period = 'lastmonth';
      } else if (lowerMsg.includes('this year') || lowerMsg.includes('thisyear')) {
        period = 'thisyear';
      } else if (lowerMsg.includes('last year') || lowerMsg.includes('lastyear')) {
        period = 'lastyear';
      } else if (lowerMsg.includes('all time') || lowerMsg.includes('alltime') || lowerMsg.includes('total') || lowerMsg.includes('ever')) {
        period = 'alltime';
      }
      
      const person = await teamwork.people.me();
      const userId = person.id;
      const userName = [person.firstName, person.lastName].filter(Boolean).join(' ');
      
      const today = new Date();
      const format = (d: Date) => d.toISOString().split('T')[0];
      let startDate: string, endDate: string;
      
      switch (period) {
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = format(yesterday);
          endDate = format(yesterday);
          break;
        }
        case 'thisweek': {
          const monday = new Date(today);
          monday.setDate(today.getDate() - today.getDay() + 1);
          startDate = format(monday);
          endDate = format(today);
          break;
        }
        case 'lastweek': {
          const lastMonday = new Date(today);
          lastMonday.setDate(today.getDate() - today.getDay() - 6);
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          startDate = format(lastMonday);
          endDate = format(lastSunday);
          break;
        }
        case 'thismonth': {
          const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate = format(firstOfMonth);
          endDate = format(today);
          break;
        }
        case 'lastmonth': {
          const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
          startDate = format(firstOfLastMonth);
          endDate = format(lastOfLastMonth);
          break;
        }
        case 'thisyear': {
          const firstOfYear = new Date(today.getFullYear(), 0, 1);
          startDate = format(firstOfYear);
          endDate = format(today);
          break;
        }
        case 'lastyear': {
          const firstOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
          const lastOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
          startDate = format(firstOfLastYear);
          endDate = format(lastOfLastYear);
          break;
        }
        case 'last3months': {
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setMonth(today.getMonth() - 3);
          startDate = format(threeMonthsAgo);
          endDate = format(today);
          break;
        }
        case 'last6months': {
          const sixMonthsAgo = new Date(today);
          sixMonthsAgo.setMonth(today.getMonth() - 6);
          startDate = format(sixMonthsAgo);
          endDate = format(today);
          break;
        }
        case 'alltime': {
          const fiveYearsAgo = new Date(today);
          fiveYearsAgo.setFullYear(today.getFullYear() - 5);
          startDate = format(fiveYearsAgo);
          endDate = format(today);
          break;
        }
        case 'dynamic': {
          // Dynamic period based on parsed days
          if (dynamicDays) {
            const pastDate = new Date(today);
            pastDate.setDate(today.getDate() - dynamicDays);
            startDate = format(pastDate);
            endDate = format(today);
          } else {
            startDate = format(today);
            endDate = format(today);
          }
          break;
        }
        default:
          startDate = format(today);
          endDate = format(today);
      }
      
      // Increase page size for longer periods (including dynamic periods over 30 days)
      const isLongPeriod = ['alltime', 'thisyear', 'lastyear', 'last6months', 'last3months', 'thismonth', 'lastmonth'].includes(period) 
        || (period === 'dynamic' && dynamicDays && dynamicDays > 30);
      const pageSize = isLongPeriod ? 500 : 100;
      
      const timeResponse = await teamwork.timeEntries.list({
        startDate,
        endDate,
        include: ['tasks', 'projects'],
        orderBy: 'date',
        orderMode: 'desc',
        pageSize,
        ...(projectId ? { projectIds: [projectId] } : {}),
      });
      
      // Filter to user's entries, and optionally by project
      let myTimeEntries = timeResponse.timelogs.filter(t => t.userId === userId);
      if (projectId) {
        myTimeEntries = myTimeEntries.filter(t => t.projectId === projectId);
      }
      const totalMinutes = myTimeEntries.reduce((sum, e) => sum + e.minutes, 0);
      
      let activities: any[] = [];
      try {
        const activityResponse = await teamwork.activity.list({
          userIds: [userId],
          startDate,
          endDate,
          activityTypes: ['task', 'task_comment'],
          pageSize: 50,
          orderMode: 'desc',
          ...(projectId ? { projectIds: [projectId] } : {}),
        });
        activities = activityResponse.activities;
      } catch (err) {
        // Ignore activity errors
      }
      
      // Create human-readable period label BEFORE using it
      let periodLabel: string;
      if (period === 'dynamic' && dynamicDays) {
        if (dynamicDays % 365 === 0) {
          periodLabel = `Last ${dynamicDays / 365} year${dynamicDays / 365 > 1 ? 's' : ''}`;
        } else if (dynamicDays % 30 === 0) {
          periodLabel = `Last ${dynamicDays / 30} month${dynamicDays / 30 > 1 ? 's' : ''}`;
        } else if (dynamicDays % 7 === 0) {
          periodLabel = `Last ${dynamicDays / 7} week${dynamicDays / 7 > 1 ? 's' : ''}`;
        } else {
          periodLabel = `Last ${dynamicDays} day${dynamicDays > 1 ? 's' : ''}`;
        }
      } else {
        periodLabel = period;
      }
      
      const activityData = {
        user: { id: userId, name: userName },
        period: { startDate, endDate, label: periodLabel },
        project: projectId ? { id: projectId, name: projectName || `Project #${projectId}` } : null,
        summary: {
          totalMinutes,
          totalHours: (totalMinutes / 60).toFixed(1),
          taskCount: new Set(myTimeEntries.map(e => e.taskId).filter(Boolean)).size,
          entryCount: myTimeEntries.length,
        },
        timeEntries: myTimeEntries.slice(0, 10),
        activities: activities.slice(0, 10),
      };
      
      // Store full time entries for CardAgent (not just first 10)
      storedTimeEntries = myTimeEntries.map(e => ({
        id: e.id,
        taskId: e.taskId,
        taskName: timeResponse.included?.tasks?.[String(e.taskId)]?.name || `Task #${e.taskId}`,
        projectId: e.projectId,
        projectName: timeResponse.included?.projects?.[String(e.projectId)]?.name || projectName || `Project #${e.projectId}`,
        minutes: e.minutes,
        hours: e.minutes / 60,
        date: e.date,
        description: e.description || '',
        billable: e.billable,
      }));
      storedPeriodLabel = periodLabel;
      storedProjectName = projectName;
      
      const projectContext = projectId 
        ? `\n\nNote: User is asking about project "${projectName || projectId}" specifically.` 
        : '\n\nNote: User is asking about ALL projects (no specific project selected).';
      
      fullMessage = `User question: ${message}${projectContext}\n\nActivity data:\n${JSON.stringify(activityData, null, 2)}`;
    } catch (err) {
      console.error('Error fetching activity data:', err);
    }
  }

  // Start visualization agent in PARALLEL for status mode (runs alongside main agent)
  let vizPromise: Promise<any | null> | null = null;
  if (mode === 'status' && storedTimeEntries.length > 0) {
    const totalMinutes = storedTimeEntries.reduce((sum: number, e: any) => sum + e.minutes, 0);
    vizPromise = runVisualizationAgent({
      question: message,
      periodLabel: storedPeriodLabel,
      projectName: storedProjectName,
      timeEntries: storedTimeEntries,
      summary: {
        totalHours: (totalMinutes / 60).toFixed(1),
        taskCount: new Set(storedTimeEntries.map((e: any) => e.taskId).filter(Boolean)).size,
        entryCount: storedTimeEntries.length,
      },
    });
    console.log('Started visualization agent in parallel');
  }

  // Spawn Claude CLI with streaming output (main conversational agent)
  const proc = Bun.spawn(['claude', '-p', '--verbose', '--output-format', 'stream-json', '--system-prompt-file', promptPath, fullMessage], {
    cwd: process.cwd() + '/../..',
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: undefined,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = proc.stdout.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Parse the stream-json output and extract text chunks
          const text = new TextDecoder().decode(value);
          const lines = text.split('\n').filter(line => line.trim());
          
          let seenTexts = new Set<string>();
          
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              
              // Extract content from assistant messages
              if (json.type === 'assistant' && json.message?.content) {
                for (const block of json.message.content) {
                  if (block.type === 'text' && block.text) {
                    // Show intermediate text as "thinking"
                    // Only show if we haven't seen this exact text before
                    if (!seenTexts.has(block.text)) {
                      seenTexts.add(block.text);
                      const truncated = block.text.length > 150 
                        ? block.text.slice(0, 150) + '...' 
                        : block.text;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'thinking',
                        thinking: truncated,
                        fullText: block.text
                      })}\n\n`));
                    }
                  }
                }
              } else if (json.type === 'result' && json.result) {
                // Final result - clean up any display hints
                const fullText = json.result;
                const cleanText = removeDisplayHints(fullText);
                
                // Send the clean text result
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'result',
                  text: cleanText, 
                  final: true 
                })}\n\n`));
                
                // Wait for visualization agent if running in parallel
                if (vizPromise) {
                  try {
                    console.log('Waiting for visualization agent...');
                    const vizSpec = await vizPromise;
                    if (vizSpec) {
                      console.log('Visualization agent returned:', vizSpec.type);
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'visualization',
                        spec: vizSpec
                      })}\n\n`));
                    }
                  } catch (vizErr) {
                    console.error('Visualization agent error:', vizErr);
                  }
                }
              }
            } catch {
              // Not JSON or parsing error, skip
            }
          }
        }
        
        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (error) {
        controller.error(error);
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

// Main server
const server = Bun.serve({
  port: 3051,
  
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // API Routes
    try {
      // GET /api/projects
      if (method === 'GET' && pathname === '/api/projects') {
        return handleGetProjects();
      }

      // GET /api/projects/:id
      const projectIdMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
      if (method === 'GET' && projectIdMatch) {
        return handleGetProject(parseInt(projectIdMatch[1]));
      }

      // GET /api/projects/:id/tasks
      const projectTasksMatch = pathname.match(/^\/api\/projects\/(\d+)\/tasks$/);
      if (method === 'GET' && projectTasksMatch) {
        return handleGetProjectTasks(parseInt(projectTasksMatch[1]));
      }

      // GET /api/projects/:id/time-entries
      const projectTimeMatch = pathname.match(/^\/api\/projects\/(\d+)\/time-entries$/);
      if (method === 'GET' && projectTimeMatch) {
        return handleGetTimeEntries(parseInt(projectTimeMatch[1]));
      }

      // GET /api/time-entries
      if (method === 'GET' && pathname === '/api/time-entries') {
        const projectId = url.searchParams.get('projectId');
        return handleGetTimeEntries(projectId ? parseInt(projectId) : undefined);
      }

      // POST /api/tasks/:id/time
      const taskTimeMatch = pathname.match(/^\/api\/tasks\/(\d+)\/time$/);
      if (method === 'POST' && taskTimeMatch) {
        const body = await req.json();
        return handleCreateTimeEntry(parseInt(taskTimeMatch[1]), body);
      }

      // POST /api/chat (legacy - uses Anthropic API)
      if (method === 'POST' && pathname === '/api/chat') {
        const body = await req.json();
        return handleChatProxy(body);
      }

      // POST /api/claude - Uses Claude CLI with subscription auth
      if (method === 'POST' && pathname === '/api/claude') {
        const body = await req.json();
        return handleClaudeChat(body);
      }

      // POST /api/claude/stream - Streaming version
      if (method === 'POST' && pathname === '/api/claude/stream') {
        const body = await req.json();
        return handleClaudeChatStream(body);
      }

      // GET /api/workflows
      if (method === 'GET' && pathname === '/api/workflows') {
        return handleGetWorkflows();
      }

      // GET /api/workflows/:id/stages
      const workflowStagesMatch = pathname.match(/^\/api\/workflows\/(\d+)\/stages$/);
      if (method === 'GET' && workflowStagesMatch) {
        return handleGetWorkflowStages(parseInt(workflowStagesMatch[1]));
      }

      // GET /api/me - Current user
      if (method === 'GET' && pathname === '/api/me') {
        return handleGetCurrentUser();
      }

      // GET /api/activity - Activity feed
      if (method === 'GET' && pathname === '/api/activity') {
        return handleGetActivity(url);
      }

      // GET /api/activity-status - User activity summary
      if (method === 'GET' && pathname === '/api/activity-status') {
        return handleGetActivityStatus(url);
      }

      // Health check
      if (method === 'GET' && pathname === '/api/health') {
        return jsonResponse({
          status: 'ok',
          hasTeamworkConfig: !!TEAMWORK_API_URL && !!TEAMWORK_BEARER_TOKEN,
          hasAnthropicConfig: !!ANTHROPIC_API_KEY,
          defaultProjectId: TEAMWORK_PROJECT_ID,
        });
      }

      // 404 for unknown API routes
      if (pathname.startsWith('/api/')) {
        return errorResponse('Not found', 404);
      }

      // For non-API routes, return 404 (Vite handles frontend in dev)
      return errorResponse('Not found', 404);

    } catch (error) {
      console.error('Server error:', error);
      return errorResponse('Internal server error');
    }
  },
});

console.log(`Backend server running at http://localhost:${server.port}`);
console.log(`Teamwork API: ${TEAMWORK_API_URL}`);
console.log(`Default Project ID: ${TEAMWORK_PROJECT_ID}`);
