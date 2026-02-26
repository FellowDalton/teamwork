/**
 * StreamContext - React context provider wrapping the stream pipeline
 *
 * Provides the NdjsonParser + StreamRouter to the component tree.
 * Components use useStreamContext() to access the router for subscriptions,
 * and the parent component calls feed() to push stream data in.
 */

import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { NdjsonParser } from '../core/NdjsonParser';
import { StreamRouter } from '../core/StreamRouter';
import { StreamRegistry } from '../core/StreamRegistry';
import type { StreamHooks } from '../core/types';

interface StreamContextValue {
  /** The stream router (for subscribing to state) */
  router: StreamRouter;
  /** Feed raw text into the NDJSON parser */
  feed: (chunk: string) => void;
  /** Flush the parser (call when stream ends) */
  flush: () => void;
  /** Reset all accumulators and parser */
  reset: () => void;
  /** Get the detection pattern for all registered plugins */
  getDetectionPattern: () => RegExp;
}

const StreamCtx = createContext<StreamContextValue | null>(null);

interface StreamProviderProps {
  children: React.ReactNode;
  hooks?: StreamHooks;
}

export const StreamProvider: React.FC<StreamProviderProps> = ({ children, hooks }) => {
  // Create router and parser once, stable across renders
  const routerRef = useRef<StreamRouter | null>(null);
  const parserRef = useRef<NdjsonParser | null>(null);

  if (!routerRef.current) {
    const plugins = StreamRegistry.getAll();
    routerRef.current = new StreamRouter(plugins, hooks);
    parserRef.current = new NdjsonParser((line) => {
      routerRef.current!.route(line);
    });
  }

  const feed = useCallback((chunk: string) => {
    parserRef.current?.feed(chunk);
  }, []);

  const flush = useCallback(() => {
    parserRef.current?.flush();
  }, []);

  const reset = useCallback(() => {
    parserRef.current?.reset();
    routerRef.current?.reset();
  }, []);

  const getDetectionPattern = useCallback(() => {
    return StreamRegistry.buildDetectionPattern();
  }, []);

  const value = useMemo<StreamContextValue>(() => ({
    router: routerRef.current!,
    feed,
    flush,
    reset,
    getDetectionPattern,
  }), [feed, flush, reset, getDetectionPattern]);

  return <StreamCtx.Provider value={value}>{children}</StreamCtx.Provider>;
};

/** Access the stream context. Throws if used outside StreamProvider. */
export function useStreamContext(): StreamContextValue {
  const ctx = useContext(StreamCtx);
  if (!ctx) {
    throw new Error('useStreamContext must be used within a StreamProvider');
  }
  return ctx;
}

/** Access the stream context, returning null if outside StreamProvider */
export function useOptionalStreamContext(): StreamContextValue | null {
  return useContext(StreamCtx);
}
