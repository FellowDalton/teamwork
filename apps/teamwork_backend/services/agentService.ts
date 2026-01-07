import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

// Lazy-load Anthropic client (env vars loaded after import in server.ts)
let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      anthropic = new Anthropic({ apiKey });
    }
  }
  return anthropic;
}

// Load agent prompts
const PROMPTS_DIR = join(process.cwd(), '..', '..', 'prompts', 'agents');

function loadPrompt(agentName: string): string {
  const promptPath = join(PROMPTS_DIR, `${agentName}.txt`);
  return readFileSync(promptPath, 'utf-8');
}

export interface CardData {
  id: string;
  type: 'timelog';
  projectName: string;
  taskName: string;
  hours: number;
  date: string;
  description?: string;
}

export interface CardAgentResponse {
  cards: CardData[];
  summary: {
    totalHours: number;
    totalEntries: number;
    totalTasks: number;
    periodLabel: string;
  };
}

export interface DisplayHint {
  type: 'cards' | 'graph';
  subtype?: string; // e.g., 'hours_by_day', 'hours_by_project'
}

// Parse display hints from Opus response
export function parseDisplayHints(text: string): DisplayHint[] {
  const hints: DisplayHint[] = [];
  const regex = /\[\[DISPLAY:(\w+)(?::(\w+))?\]\]/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    hints.push({
      type: match[1] as 'cards' | 'graph',
      subtype: match[2],
    });
  }
  
  return hints;
}

// Remove display hints from text for clean display
export function removeDisplayHints(text: string): string {
  return text.replace(/\[\[DISPLAY:\w+(?::\w+)?\]\]\n?/g, '').trim();
}

// Call the CardAgent (Haiku) to format time entries as cards
export async function callCardAgent(
  timeEntries: any[],
  context: { periodLabel?: string; projectName?: string }
): Promise<CardAgentResponse | null> {
  const client = getAnthropicClient();
  if (!client) {
    console.error('Anthropic client not initialized - missing ANTHROPIC_API_KEY');
    return null;
  }

  try {
    const systemPrompt = loadPrompt('card-agent');
    
    const userMessage = `Format these time entries as cards:

Context:
- Period: ${context.periodLabel || 'Recent'}
- Project: ${context.projectName || 'All projects'}

Time Entries:
${JSON.stringify(timeEntries, null, 2)}`;

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Extract text from response
    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('Unexpected response type from Haiku');
      return null;
    }

    // Parse JSON response
    const jsonText = content.text.trim();
    const parsed = JSON.parse(jsonText) as CardAgentResponse;
    return parsed;
  } catch (error) {
    console.error('CardAgent error:', error);
    return null;
  }
}

// Future: GraphAgent for chart data
export async function callGraphAgent(
  data: any[],
  graphType: string,
  context: { periodLabel?: string }
): Promise<any | null> {
  // TODO: Implement when graph-agent.txt is created
  console.log('GraphAgent not yet implemented:', graphType);
  return null;
}
