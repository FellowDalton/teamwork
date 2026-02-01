/**
 * Chat Builder Template - Backend Server
 *
 * EXAMPLE: Outline Builder
 * Creates structured outlines with sections and bullet points.
 *
 * This demonstrates:
 * 1. SSE streaming for real-time responses
 * 2. Claude API integration
 * 3. Progressive draft building with JSON Lines
 *
 * See docs/BUILDER_GUIDE.md for how to customize this for your use case.
 */

import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// =============================================================================
// EXAMPLE: OUTLINE BUILDER
//
// This creates outlines like:
//   📄 Marketing Strategy Outline
//   ├── 📁 Market Analysis
//   │   ├── Target audience research
//   │   │   └── Demographics study
//   │   │   └── User interviews
//   │   └── Competitor analysis
//   ├── 📁 Strategy Development
//   │   ├── Brand positioning
//   │   └── Channel selection
//   └── 📁 Implementation Plan
//       ├── Timeline
//       └── Budget allocation
//
// To customize for your use case, see docs/BUILDER_GUIDE.md
// =============================================================================

const SYSTEM_PROMPTS: Record<string, string> = {
  create: `You are an Outline Builder that creates structured outlines progressively.

When the user describes what they want to outline, generate the structure using JSON Lines format.
Output one JSON object per line - this allows the UI to display items as they're generated.

## Output Format

Each line must be a valid JSON object with a "type" field:

1. Start with the outline title:
{"type":"draft","name":"Outline Title","description":"Brief description of the outline"}

2. Add sections (main categories):
{"type":"section","id":"s1","name":"Section Name","description":"What this section covers"}

3. Add items to sections (key points):
{"type":"item","id":"i1","sectionId":"s1","name":"Item Name","description":"Optional details"}

4. Add sub-items for detail (supporting points):
{"type":"subitem","itemId":"i1","name":"Sub-item text"}

5. End with completion:
{"type":"complete","message":"Outline complete!"}

## Guidelines

- Create 3-6 logical sections that organize the topic
- Each section should have 2-5 items
- Add sub-items only when additional detail helps
- Use clear, concise names (not full sentences)
- Descriptions are optional - use when helpful
- Generate progressively - don't output everything at once

## Example

User: "Create an outline for a blog post about learning to code"

{"type":"draft","name":"Learning to Code: A Beginner's Guide","description":"Comprehensive guide for programming newcomers"}
{"type":"section","id":"s1","name":"Getting Started","description":"First steps for new coders"}
{"type":"item","id":"i1","sectionId":"s1","name":"Choosing Your First Language"}
{"type":"subitem","itemId":"i1","name":"Python for beginners"}
{"type":"subitem","itemId":"i1","name":"JavaScript for web"}
{"type":"item","id":"i2","sectionId":"s1","name":"Setting Up Your Environment"}
{"type":"subitem","itemId":"i2","name":"Code editor selection"}
{"type":"subitem","itemId":"i2","name":"Terminal basics"}
{"type":"section","id":"s2","name":"Learning Resources","description":"Where to learn effectively"}
{"type":"item","id":"i3","sectionId":"s2","name":"Online Courses"}
{"type":"item","id":"i4","sectionId":"s2","name":"Documentation & Tutorials"}
{"type":"item","id":"i5","sectionId":"s2","name":"Practice Projects"}
{"type":"section","id":"s3","name":"Building Skills","description":"Growing as a developer"}
{"type":"item","id":"i6","sectionId":"s3","name":"Debugging Techniques"}
{"type":"item","id":"i7","sectionId":"s3","name":"Reading Others' Code"}
{"type":"item","id":"i8","sectionId":"s3","name":"Contributing to Open Source"}
{"type":"complete","message":"Outline ready for your blog post!"}

Now create an outline based on the user's request.`,

  query: `You are a helpful assistant that answers questions about outlines and organization.
Help users understand how to structure their content effectively.
Use markdown formatting when appropriate.`,

  general: `You are a helpful assistant. You can help users think through what they want to outline,
or answer questions about organization and structure. Be concise and helpful.`,
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
