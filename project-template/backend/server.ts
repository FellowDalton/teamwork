/**
 * Chat Builder Template - Backend Server
 *
 * This is a minimal backend that demonstrates:
 * 1. SSE streaming for real-time responses
 * 2. Claude API integration
 * 3. Progressive draft building
 *
 * Customize the system prompts and tools for your specific use case.
 */

import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// =============================================================================
// SYSTEM PROMPTS - Customize these for your use case
// =============================================================================

const SYSTEM_PROMPTS: Record<string, string> = {
  create: `You are a helpful assistant that creates structured content progressively.

When the user describes what they want to create, generate the structure using JSON Lines format.
Each line should be a complete JSON object with a "type" field.

Output format (one JSON object per line):
{"type":"draft","name":"Draft Name","description":"Optional description"}
{"type":"section","id":"section-1","name":"Section Name","description":"Optional"}
{"type":"item","id":"item-1","sectionId":"section-1","name":"Item Name","description":"Optional"}
{"type":"subitem","itemId":"item-1","name":"Sub-item Name"}
{"type":"complete","message":"Structure complete!"}

Guidelines:
- Output each JSON object on its own line
- Generate sections, items, and sub-items progressively
- Use meaningful, descriptive names
- Include descriptions when helpful
- End with a "complete" type message

Example for "Create a project plan for a website":
{"type":"draft","name":"Website Project Plan","description":"Comprehensive plan for building a modern website"}
{"type":"section","id":"s1","name":"Planning Phase","description":"Initial research and planning"}
{"type":"item","id":"i1","sectionId":"s1","name":"Requirements Gathering"}
{"type":"subitem","itemId":"i1","name":"Stakeholder interviews"}
{"type":"subitem","itemId":"i1","name":"Competitor analysis"}
{"type":"item","id":"i2","sectionId":"s1","name":"Technical Architecture"}
{"type":"section","id":"s2","name":"Development Phase","description":"Building the website"}
{"type":"item","id":"i3","sectionId":"s2","name":"Frontend Development"}
{"type":"item","id":"i4","sectionId":"s2","name":"Backend Development"}
{"type":"complete","message":"Project plan structure generated successfully!"}`,

  query: `You are a helpful assistant that answers questions clearly and concisely.
Provide informative responses and use markdown formatting when appropriate.`,

  general: `You are a helpful assistant. Be concise and helpful.
Use markdown formatting when appropriate.`,
};

// =============================================================================
// ANTHROPIC CLIENT
// =============================================================================

let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// =============================================================================
// SSE STREAMING HANDLER
// =============================================================================

interface StreamRequest {
  message: string;
  mode: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

async function handleStream(req: Request): Promise<Response> {
  const body: StreamRequest = await req.json();
  const { message, mode, conversationHistory } = body;

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.general;

  // Build messages array
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (conversationHistory) {
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  messages.push({ role: 'user', content: message });

  // Create SSE response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        // Send init event
        enqueue(JSON.stringify({ type: 'init', model: 'claude-sonnet-4-20250514' }));

        const client = getAnthropicClient();

        // Use streaming
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          stream: true,
        });

        let fullText = '';

        for await (const event of response) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if ('text' in delta) {
              fullText += delta.text;

              // For create mode, parse JSON Lines and emit draft events
              if (mode === 'create') {
                // Send as thinking (shows progress)
                enqueue(JSON.stringify({ type: 'thinking', thinking: delta.text }));

                // Parse complete lines for draft events
                const lines = fullText.split('\n');
                for (let i = 0; i < lines.length - 1; i++) {
                  const line = lines[i].trim();
                  if (!line) continue;

                  try {
                    const parsed = JSON.parse(line);

                    switch (parsed.type) {
                      case 'draft':
                        enqueue(
                          JSON.stringify({
                            type: 'draft_init',
                            draft: {
                              id: `draft-${Date.now()}`,
                              name: parsed.name,
                              description: parsed.description,
                              sections: [],
                              summary: { totalSections: 0, totalItems: 0, totalSubItems: 0 },
                              message: '',
                              isDraft: true,
                              isBuilding: true,
                            },
                          })
                        );
                        break;

                      case 'section':
                        enqueue(
                          JSON.stringify({
                            type: 'draft_update',
                            action: 'add_section',
                            section: {
                              id: parsed.id,
                              name: parsed.name,
                              description: parsed.description,
                              items: [],
                            },
                          })
                        );
                        break;

                      case 'item':
                        enqueue(
                          JSON.stringify({
                            type: 'draft_update',
                            action: 'add_item',
                            sectionId: parsed.sectionId,
                            item: {
                              id: parsed.id,
                              name: parsed.name,
                              description: parsed.description,
                              children: [],
                            },
                          })
                        );
                        break;

                      case 'subitem':
                        enqueue(
                          JSON.stringify({
                            type: 'draft_update',
                            action: 'add_subitem',
                            itemId: parsed.itemId,
                            subitems: [
                              {
                                id: `subitem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                name: parsed.name,
                                description: parsed.description,
                              },
                            ],
                          })
                        );
                        break;

                      case 'complete':
                        enqueue(
                          JSON.stringify({
                            type: 'draft_complete',
                            message: parsed.message,
                          })
                        );
                        break;
                    }
                  } catch {
                    // Not valid JSON, skip
                  }
                }

                // Keep only the last incomplete line
                fullText = lines[lines.length - 1];
              } else {
                // For other modes, send text directly
                enqueue(JSON.stringify({ type: 'text', text: delta.text }));
              }
            }
          }
        }

        // Send completion
        enqueue('[DONE]');
        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        enqueue(
          JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        );
        enqueue('[DONE]');
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// =============================================================================
// SUBMIT HANDLER
// =============================================================================

interface SubmitRequest {
  id: string;
  name: string;
  sections: unknown[];
}

async function handleSubmit(req: Request): Promise<Response> {
  const body: SubmitRequest = await req.json();

  // This is where you would save the draft to a database or external service
  // For this template, we just return success

  console.log('Submitted draft:', body.name);

  return Response.json({
    success: true,
    id: body.id,
    url: `https://example.com/drafts/${body.id}`,
    message: `Successfully submitted "${body.name}"!`,
  });
}

// =============================================================================
// SERVER
// =============================================================================

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Routes
    if (url.pathname === '/api/stream' && req.method === 'POST') {
      return handleStream(req);
    }

    if (url.pathname === '/api/submit' && req.method === 'POST') {
      return handleSubmit(req);
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
