import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/architecture')({
  component: ArchitecturePage,
});

function ArchitecturePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Architecture</h1>
      <p className="text-zinc-400 mb-8">
        The streaming UI framework is a pluggable pipeline that transforms raw NDJSON
        streams into progressively-rendered React components.
      </p>

      {/* Pipeline Diagram */}
      <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-6 mb-6">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Data Flow Pipeline</h2>
        <div className="font-mono text-xs leading-relaxed text-zinc-400">
          <pre className="overflow-x-auto">{`
  Edge Worker (Cloudflare/Vercel)
  ┌─────────────────────────────────┐
  │  SSE / NDJSON Response Stream   │
  │  {"type":"project","name":"..."} │
  │  {"type":"task","id":"t-1",...}  │
  └──────────────┬──────────────────┘
                 │ ReadableStream
                 ▼
  ┌──────────────────────────────────┐
  │  NdjsonParser                    │
  │  • Buffers text chunks           │
  │  • Splits by newline             │
  │  • Validates JSON + type field   │
  │  • Emits StreamLine objects      │
  └──────────────┬───────────────────┘
                 │ StreamLine
                 ▼
  ┌──────────────────────────────────┐
  │  StreamRouter                    │
  │  • Type → Plugin index (O(1))    │
  │  • Multi-plugin dispatch         │
  │  • Version counter for sync      │
  │  • useSyncExternalStore API      │
  └──────┬───────────┬───────────────┘
         │           │
         ▼           ▼
  ┌─────────────┐ ┌─────────────────┐
  │ Project     │ │ Dashboard       │
  │ Accumulator │ │ Accumulator     │
  │ (state +=)  │ │ (state +=)      │
  └──────┬──────┘ └───────┬─────────┘
         │               │
         ▼               ▼
  ┌─────────────┐ ┌─────────────────┐
  │ Project     │ │ Dashboard       │
  │ Renderer    │ │ Renderer        │
  │ (React)     │ │ (React)         │
  └─────────────┘ └─────────────────┘
          `}</pre>
        </div>
      </div>

      {/* Key Concepts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <ConceptCard
          title="StreamPlugin Interface"
          code={`interface StreamPlugin<TState> {
  id: string;
  displayName: string;
  lineTypes: string[];
  createAccumulator(): StreamAccumulator<TState>;
  Renderer: React.ComponentType<{state: TState}>;
}`}
          desc="Each domain (project, dashboard, etc.) implements this interface to participate in the stream pipeline."
        />
        <ConceptCard
          title="StreamAccumulator"
          code={`interface StreamAccumulator<TState> {
  accepts(line: StreamLine): boolean;
  processLine(line): TState;
  isComplete(): boolean;
  getState(): TState;
  reset(): void;
}`}
          desc="Accumulators build domain state incrementally from each stream line. State is immutable snapshots for React."
        />
        <ConceptCard
          title="useSyncExternalStore"
          code={`const { state, isActive } = useStreamState(
  router,  // external store
  'project' // plugin ID
);
// Re-renders only when this plugin's state changes`}
          desc="React 18+ hook for tear-free reads of external mutable stores. Zero unnecessary re-renders."
        />
        <ConceptCard
          title="Edge Worker Compatible"
          code={`// Worker entry point
export default {
  async fetch(request: Request) {
    const stream = new ReadableStream({...});
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  }
}`}
          desc="The NDJSON format works natively with edge workers. No WebSocket needed - just ReadableStream + SSE."
        />
      </div>

      {/* Stack */}
      <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Vite', desc: 'Build & HMR', color: 'text-purple-400' },
            { name: 'TanStack Router', desc: 'Type-safe routing', color: 'text-cyan-400' },
            { name: 'React 19', desc: 'UI framework', color: 'text-blue-400' },
            { name: 'Edge Workers', desc: 'Serve at the edge', color: 'text-amber-400' },
          ].map(({ name, desc, color }) => (
            <div key={name} className="bg-zinc-800/40 rounded-lg p-3 border border-zinc-800 text-center">
              <div className={`text-sm font-semibold ${color}`}>{name}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConceptCard({ title, code, desc }: { title: string; code: string; desc: string }) {
  return (
    <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-200 mb-2">{title}</h3>
      <pre className="text-[11px] font-mono text-cyan-300/80 bg-zinc-950 rounded-lg p-3 mb-2 overflow-x-auto">
        {code}
      </pre>
      <p className="text-xs text-zinc-500">{desc}</p>
    </div>
  );
}
