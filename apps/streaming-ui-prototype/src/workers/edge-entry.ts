/**
 * Edge Worker Entry Point (Cloudflare Workers / Vercel Edge)
 *
 * This is a reference implementation showing how to serve the
 * streaming UI from an edge worker with NDJSON responses.
 *
 * In production, this would:
 * 1. Serve static assets from KV/R2
 * 2. Handle /api/stream with SSE NDJSON responses
 * 3. Fallback to SPA for client-side routing
 */

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AI_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API: Streaming NDJSON endpoint
    if (url.pathname === '/api/stream' && request.method === 'POST') {
      return handleStream(request, env);
    }

    // Static assets
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
    } catch {
      // Fall through to SPA
    }

    // SPA fallback for TanStack Router client-side routing
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
  },
};

async function handleStream(request: Request, env: Env): Promise<Response> {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Example: stream NDJSON lines
  const streamNdjson = async () => {
    try {
      // In production, this would call your AI backend and stream the response
      // For now, we show the pattern:
      const lines = [
        { type: 'project', name: 'Edge Project', description: 'Built at the edge' },
        { type: 'tasklist', id: 'tl-1', name: 'Setup' },
        { type: 'task', id: 't-1', tasklistId: 'tl-1', name: 'Deploy worker' },
        { type: 'complete', message: 'Done!' },
      ];

      for (const line of lines) {
        await writer.write(encoder.encode(JSON.stringify(line) + '\n'));
        // Simulate processing time
        await new Promise(r => setTimeout(r, 100));
      }
    } finally {
      await writer.close();
    }
  };

  // Start streaming without blocking the response
  streamNdjson();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
