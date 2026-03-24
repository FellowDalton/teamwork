import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { NdjsonParser } from '../core/NdjsonParser';
import { StreamRouter } from '../core/StreamRouter';
import { StreamRegistry } from '../core/StreamRegistry';

interface StreamContextValue {
  router: StreamRouter;
  feed: (chunk: string) => void;
  flush: () => void;
  reset: () => void;
}

const StreamCtx = createContext<StreamContextValue | null>(null);

export const StreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const routerRef = useRef<StreamRouter | null>(null);
  const parserRef = useRef<NdjsonParser | null>(null);

  if (!routerRef.current) {
    const plugins = StreamRegistry.getAll();
    routerRef.current = new StreamRouter(plugins);
    parserRef.current = new NdjsonParser((line) => {
      routerRef.current!.route(line);
    });
  }

  const feed = useCallback((chunk: string) => parserRef.current?.feed(chunk), []);
  const flush = useCallback(() => parserRef.current?.flush(), []);
  const reset = useCallback(() => {
    parserRef.current?.reset();
    routerRef.current?.reset();
  }, []);

  const value = useMemo<StreamContextValue>(() => ({
    router: routerRef.current!,
    feed,
    flush,
    reset,
  }), [feed, flush, reset]);

  return <StreamCtx.Provider value={value}>{children}</StreamCtx.Provider>;
};

export function useStreamContext(): StreamContextValue {
  const ctx = useContext(StreamCtx);
  if (!ctx) throw new Error('useStreamContext must be used within a StreamProvider');
  return ctx;
}
