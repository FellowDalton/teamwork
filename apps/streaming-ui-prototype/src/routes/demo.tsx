import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { useStreamContext } from '../streaming/hooks/StreamContext';
import { StreamPanel } from '../components/StreamPanel';
import { simulateStream, type StreamScenario } from '../mock/streamSimulator';

export const Route = createFileRoute('/demo')({
  component: DemoPage,
});

function DemoPage() {
  const { feed, flush, reset } = useStreamContext();
  const [isStreaming, setIsStreaming] = useState(false);
  const [scenario, setScenario] = useState<StreamScenario>('project');
  const [speed, setSpeed] = useState(80);

  const startStream = useCallback(async () => {
    reset();
    setIsStreaming(true);
    await simulateStream(scenario, (chunk) => feed(chunk), { speedMs: speed });
    flush();
    setIsStreaming(false);
  }, [scenario, speed, feed, flush, reset]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Mock Stream Demo</h1>
        <p className="text-zinc-500 text-sm">
          Test the streaming UI with mock data — no backend required.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Scenario:</span>
            <div className="flex gap-1">
              {(['project', 'dashboard', 'both'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  disabled={isStreaming}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                    scenario === s
                      ? 'bg-cyan-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                  } disabled:opacity-50`}
                >
                  {s === 'both' ? 'Multi-Plugin' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Speed:</span>
            <input
              type="range" min={20} max={300} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={isStreaming}
              className="w-24 accent-cyan-500"
            />
            <span className="text-xs text-zinc-400 font-mono w-12">{speed}ms</span>
          </div>

          <button
            onClick={startStream}
            disabled={isStreaming}
            className={`ml-auto flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              isStreaming
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white hover:from-cyan-500 hover:to-purple-500 shadow-lg'
            }`}
          >
            {isStreaming ? (
              <><span className="w-3 h-3 rounded-full bg-cyan-400 pulse-dot" /> Streaming...</>
            ) : (
              'Start Stream'
            )}
          </button>
        </div>
      </div>

      <StreamPanel />

      {/* Pipeline Diagram */}
      <div className="mt-8 bg-zinc-900/40 rounded-xl border border-zinc-800/50 p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-2">Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
          {[
            { step: '1', label: 'NDJSON Stream', desc: 'Typed JSON lines from edge worker' },
            { step: '2', label: 'NdjsonParser', desc: 'Buffers & splits into objects' },
            { step: '3', label: 'StreamRouter', desc: 'Routes lines by type to plugins' },
            { step: '4', label: 'Accumulators', desc: 'Build domain-specific state' },
            { step: '5', label: 'React Renders', desc: 'useSyncExternalStore updates' },
          ].map(({ step, label, desc }) => (
            <div key={step} className="bg-zinc-800/40 rounded-lg p-3 border border-zinc-800">
              <div className="text-cyan-400 font-mono font-bold text-lg mb-1">{step}</div>
              <div className="text-xs font-medium text-zinc-300">{label}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
