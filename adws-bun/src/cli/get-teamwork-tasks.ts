#!/usr/bin/env bun
/**
 * Get Teamwork Tasks CLI
 *
 * Query tasks from a Teamwork project and prepare them for agent processing.
 *
 * Usage:
 *   bun run src/cli/get-teamwork-tasks.ts <project_id> [status_filter] [limit]
 *
 * Parameters:
 *   - project_id (required): Teamwork project ID to monitor
 *   - status_filter (optional): JSON array of status names, default: ["New", "To Do"]
 *   - limit (optional): Max tasks to return, default: 10
 *
 * This tool is designed to be called as a slash command via Claude Code MCP integration.
 * It uses Claude to interact with the Teamwork MCP server.
 */

import { promptClaudeCodeWithRetry, generateShortId } from '@/modules/agent';
import type { AgentPromptRequest } from '@/modules/data-models';
import { z } from 'zod';
import { TeamworkTaskSchema, type TeamworkTask } from '@/modules/data-models';
import { join } from 'path';

// ============================================================================
// Tag Parsing
// ============================================================================

/**
 * Parse inline tags from task description: {{key: value}}
 */
function parseInlineTags(description: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const tagPattern = /\{\{(\w+):\s*([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(description)) !== null) {
    const key = match[1]?.trim() || '';
    const value = match[2]?.trim() || '';
    if (key && value) {
      tags[key] = value;
    }
  }

  return tags;
}

/**
 * Convert native Teamwork tags array to key:value dict.
 * Tags are in format "key:value" (e.g., "prototype:vite_vue", "model:sonnet")
 */
function parseNativeTags(nativeTags: string[]): Record<string, string> {
  const tags: Record<string, string> = {};

  for (const tag of nativeTags) {
    const parts = tag.split(':');
    if (parts.length === 2) {
      const key = parts[0]?.trim() || '';
      const value = parts[1]?.trim() || '';
      if (key && value) {
        tags[key] = value;
      }
    }
  }

  return tags;
}

/**
 * Merge native and inline tags (native takes precedence).
 */
function mergeTags(nativeTags: Record<string, string>, inlineTags: Record<string, string>): Record<string, string> {
  return { ...inlineTags, ...nativeTags };
}

// ============================================================================
// Execution Trigger Detection
// ============================================================================

/**
 * Detect execution trigger from task description.
 * Returns: { trigger: "execute" | "continue" | null, prompt: string }
 */
function detectExecutionTrigger(description: string): {
  trigger: string | null;
  prompt: string;
} {
  // Check if description ends with "execute"
  const executePattern = /execute\s*$/i;
  if (executePattern.test(description)) {
    // Remove "execute" and inline tags from prompt
    let prompt = description.replace(executePattern, '').trim();
    prompt = prompt.replace(/\{\{[^}]+\}\}/g, '').trim();
    return { trigger: 'execute', prompt };
  }

  // Check for "continue - <text>"
  const continuePattern = /continue\s*-\s*(.+)/i;
  const match = description.match(continuePattern);
  if (match) {
    const prompt = match[1]?.trim() || '';
    return { trigger: 'continue', prompt };
  }

  return { trigger: null, prompt: '' };
}

// ============================================================================
// Task Processing
// ============================================================================

/**
 * Process a raw Teamwork task into structured TeamworkTask format.
 */
function processTask(rawTask: any): TeamworkTask | null {
  try {
    const description = rawTask.description || '';
    const nativeTags = rawTask.tags || [];

    // Parse tags
    const parsedNativeTags = parseNativeTags(nativeTags);
    const inlineTags = parseInlineTags(description);
    const mergedTags = mergeTags(parsedNativeTags, inlineTags);

    // Detect execution trigger
    const { trigger, prompt } = detectExecutionTrigger(description);

    // Skip if no execution trigger found
    if (!trigger) {
      return null;
    }

    // Build TeamworkTask object
    const task: TeamworkTask = {
      task_id: String(rawTask.id || rawTask.task_id),
      project_id: String(rawTask.project_id || ''),
      title: rawTask.title || rawTask.content || '',
      status: rawTask.status || 'New',
      description,
      tags: mergedTags,
      worktree: mergedTags.worktree,
      model: mergedTags.model,
      workflow_type: mergedTags.workflow,
      prototype: mergedTags.prototype,
      execution_trigger: trigger,
      task_prompt: prompt,
      assigned_to: rawTask.assigned_to || null,
      created_time: rawTask.created_time || rawTask.created_at || new Date().toISOString(),
      due_date: rawTask.due_date || null,
    };

    // Validate with Zod schema
    return TeamworkTaskSchema.parse(task);
  } catch (error) {
    console.error(`[WARN] Failed to process task: ${error}`);
    return null;
  }
}

// ============================================================================
// Main CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: get-teamwork-tasks <project_id> [status_filter] [limit]');
    process.exit(1);
  }

  const projectId = args[0];
  const statusFilterJson = args[1] || '["New", "To Do"]';
  const limit = args[2] ? parseInt(args[2]) : 10;

  // Parse status filter
  let statusFilter: string[];
  try {
    statusFilter = JSON.parse(statusFilterJson);
    if (!Array.isArray(statusFilter)) {
      throw new Error('Status filter must be a JSON array');
    }
  } catch (error) {
    console.error(`Invalid status_filter JSON: ${error}`);
    process.exit(1);
  }

  console.error(`[INFO] Querying Teamwork project ${projectId}`);
  console.error(`[INFO] Status filter: ${statusFilter.join(', ')}`);
  console.error(`[INFO] Limit: ${limit}`);

  // Use Claude Code agent to query Teamwork MCP
  const adwId = generateShortId();

  // Build prompt to query Teamwork tasks
  const queryPrompt = `Use the Teamwork MCP tools to query tasks from project ${projectId}.

1. First, get the available status IDs for this project
2. Filter tasks by these status names (case-insensitive): ${statusFilter.join(', ')}
3. Return up to ${limit} tasks
4. For each task, include: id, project_id, title, status, description, tags (native Teamwork tags), assigned_to, created_at, due_date

CRITICAL: Return ONLY a valid JSON array with NO explanations or markdown. Format:
[
  {
    "id": "123",
    "project_id": "${projectId}",
    "title": "Task title",
    "status": "New",
    "description": "Full task description...",
    "tags": ["tag1:value1", "tag2:value2"],
    "assigned_to": "User Name or null",
    "created_at": "2025-01-15T10:00:00Z",
    "due_date": "2025-01-20T00:00:00Z or null"
  }
]

If no tasks found, return empty array: []`;

  // Create output directory
  const outputDir = join(process.cwd(), 'agents', adwId, 'get_teamwork_tasks');

  const request: AgentPromptRequest = {
    prompt: queryPrompt,
    adwId: adwId,
    agentName: 'get_teamwork_tasks',
    model: 'sonnet',
    dangerouslySkipPermissions: true,
    outputFile: join(outputDir, 'cc_raw_output.jsonl'),
    workingDir: process.cwd(),
  };

  try {
    const response = await promptClaudeCodeWithRetry(request);

    if (!response.success) {
      console.error(`[ERROR] Claude Code execution failed: ${response.output}`);
      process.exit(1);
    }

    // Parse the JSON response from Claude
    let rawTasks: any[];
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = response.output.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      rawTasks = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error(`[ERROR] Failed to parse Claude response as JSON: ${parseError}`);
      console.error(`[ERROR] Raw response: ${response.output}`);
      process.exit(1);
    }

    // Process tasks
    const eligibleTasks: TeamworkTask[] = [];
    for (const rawTask of rawTasks) {
      const task = processTask(rawTask);
      if (task) {
        eligibleTasks.push(task);
      }
    }

    // Output as JSON (only to stdout, not stderr)
    console.log(JSON.stringify(eligibleTasks, null, 2));
  } catch (error) {
    console.error(`[ERROR] Failed to query Teamwork: ${error}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[ERROR] Fatal error: ${error}`);
    process.exit(1);
  });
}
