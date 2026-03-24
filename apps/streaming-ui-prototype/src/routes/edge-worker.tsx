import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/edge-worker')({
  component: EdgeWorkerPage,
});

function EdgeWorkerPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Edge Worker Integration</h1>
      <p className="text-zinc-400 mb-8">
        This prototype is designed to be served from Cloudflare Workers or any edge runtime.
        The NDJSON streaming format is perfectly suited for edge delivery.
      </p>

      {/* Why Edge Workers */}
      <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-6 mb-6">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Why Edge Workers + Streaming UI?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BenefitCard
            metric="65%"
            label="TTFB Reduction"
            desc="Time to first byte drops dramatically when serving from the nearest edge location"
          />
          <BenefitCard
            metric="50%"
            label="Faster Prompts"
            desc="Streaming begins immediately - users see content building before the full response completes"
          />
          <BenefitCard
            metric="0ms"
            label="Cold Start"
            desc="V8 isolates start instantly unlike container-based serverless (Lambda, etc.)"
          />
        </div>
      </div>

      {/* Worker Code Example */}
      <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-6 mb-6">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Example: Cloudflare Worker Entry</h2>
        <pre className="text-[11px] font-mono text-cyan-300/80 bg-zinc-950 rounded-lg p-4 overflow-x-auto">
{`// worker.ts - Cloudflare Workers entry point
import { Hono } from 'hono';

const app = new Hono();

// Serve static assets from KV or R2
app.get('/assets/*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// SSE streaming endpoint - AI agent responses
app.post('/api/stream', async (c) => {
  const { message } = await c.req.json();

  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Start streaming in background
  c.executionCtx.waitUntil((async () => {
    // Call AI backend (Claude, etc.)
    const aiResponse = await fetch('https://api.anthropic.com/...', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });

    // Stream NDJSON lines as they arrive
    const reader = aiResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
    await writer.close();
  })());

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// SPA fallback - serve index.html for all routes
// TanStack Router handles client-side routing
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(
    new Request(new URL('/index.html', c.req.url))
  );
});

export default app;`}
        </pre>
      </div>

      {/* Deployment Flow */}
      <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-6 mb-6">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Deployment Architecture</h2>
        <div className="font-mono text-xs text-zinc-400">
          <pre className="overflow-x-auto">{`
  ┌─────────────────────────────────────────────────────┐
  │                   Cloudflare Edge                    │
  │                                                     │
  │  ┌──────────────┐    ┌─────────────────────────┐   │
  │  │  Static      │    │  Worker (V8 Isolate)     │   │
  │  │  Assets      │    │                          │   │
  │  │  (KV/R2)     │    │  Hono Router             │   │
  │  │              │    │  ├── /assets/* → KV       │   │
  │  │  index.html  │    │  ├── /api/stream → AI    │   │
  │  │  app.js      │    │  └── /* → SPA fallback   │   │
  │  │  styles.css  │    │                          │   │
  │  └──────────────┘    └───────────┬──────────────┘   │
  │                                  │                   │
  └──────────────────────────────────┼───────────────────┘
                                     │ NDJSON Stream
                                     ▼
                          ┌─────────────────────┐
                          │  Browser             │
                          │                      │
                          │  TanStack Router     │
                          │  ├── / (demo)        │
                          │  ├── /architecture   │
                          │  └── /edge-worker    │
                          │                      │
                          │  NdjsonParser        │
                          │  StreamRouter        │
                          │  React Renderers     │
                          └─────────────────────┘
          `}</pre>
        </div>
      </div>

      {/* Build Commands */}
      <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Build & Deploy</h2>
        <div className="space-y-2 font-mono text-xs">
          <CodeLine cmd="bun install" desc="Install dependencies" />
          <CodeLine cmd="bun run dev" desc="Dev server on :3060" />
          <CodeLine cmd="bun run build" desc="Production build → dist/" />
          <CodeLine cmd="wrangler deploy" desc="Deploy to Cloudflare Workers" />
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ metric, label, desc }: { metric: string; label: string; desc: string }) {
  return (
    <div className="bg-zinc-800/40 rounded-lg p-4 border border-zinc-800 text-center">
      <div className="text-3xl font-bold font-mono text-cyan-400 mb-1">{metric}</div>
      <div className="text-xs font-medium text-zinc-300 mb-1">{label}</div>
      <div className="text-[10px] text-zinc-500">{desc}</div>
    </div>
  );
}

function CodeLine({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 bg-zinc-950 rounded-lg px-3 py-2">
      <span className="text-zinc-600">$</span>
      <span className="text-cyan-300">{cmd}</span>
      <span className="text-zinc-600 ml-auto"># {desc}</span>
    </div>
  );
}
