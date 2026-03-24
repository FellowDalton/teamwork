import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useRef } from 'react';
import { useStreamContext } from '../streaming/hooks/StreamContext';
import { StreamPanel } from '../components/StreamPanel';
import { streamFromAgent } from '../services/streamService';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const SUGGESTIONS = [
  'Show me the sales dashboard',
  'How is the engineering team doing?',
  'Plan a website redesign project',
  'Create a mobile app MVP plan',
  'Show product metrics and user growth',
  'Build an API platform project plan',
];

function HomePage() {
  const { feed, flush, reset } = useStreamContext();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStreamed, setHasStreamed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async (message?: string) => {
    const msg = (message || input).trim();
    if (!msg || isStreaming) return;

    reset();
    setIsStreaming(true);
    setHasStreamed(true);
    setError(null);

    abortRef.current = new AbortController();

    await streamFromAgent(msg, {
      onChunk: (text) => feed(text),
      onFlush: () => flush(),
      onError: (err) => setError(err),
      signal: abortRef.current.signal,
    });

    setIsStreaming(false);
  }, [input, isStreaming, feed, flush, reset]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    flush();
    setIsStreaming(false);
  };

  return (
    <div className={`max-w-4xl mx-auto px-4 transition-all duration-500 ${
      hasStreamed ? 'py-6' : 'py-[20vh]'
    }`}>
      {/* Hero - collapses after first stream */}
      {!hasStreamed && (
        <div className="text-center mb-10 stream-item">
          <h1 className="text-4xl font-bold text-white mb-3">
            What do you need?
          </h1>
          <p className="text-zinc-500 text-lg max-w-lg mx-auto">
            Describe what you want to see. The UI will build itself.
          </p>
        </div>
      )}

      {/* Input Area */}
      <div className={`relative mb-6 transition-all duration-300 ${
        hasStreamed ? '' : 'max-w-2xl mx-auto'
      }`}>
        <div className="relative bg-zinc-900/80 backdrop-blur rounded-2xl border border-zinc-700/50 shadow-2xl shadow-black/20 focus-within:border-cyan-500/50 focus-within:shadow-cyan-500/5 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to see..."
            disabled={isStreaming}
            rows={1}
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-600 px-5 py-4 pr-24 resize-none focus:outline-none text-base disabled:opacity-50"
            style={{ minHeight: '56px', maxHeight: '120px' }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-600/30 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-purple-600 text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg"
              >
                Go
              </button>
            )}
          </div>
        </div>

        {/* Streaming Indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 mt-2 ml-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500 pulse-dot" />
            <span className="text-xs text-zinc-500">Building UI from stream...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-2 ml-1 text-xs text-amber-400">
            {error}
          </div>
        )}
      </div>

      {/* Suggestion Chips - only before first stream */}
      {!hasStreamed && (
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  handleSubmit(s);
                }}
                disabled={isStreaming}
                className="text-xs px-3 py-1.5 rounded-full bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200 hover:border-zinc-600 transition-all disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stream Output */}
      <StreamPanel />

      {/* New prompt after streaming completes */}
      {hasStreamed && !isStreaming && (
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              reset();
              setHasStreamed(false);
              setInput('');
              setError(null);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
