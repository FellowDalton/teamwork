/**
 * useStreamState - React hook for subscribing to a specific accumulator's state
 *
 * Uses useSyncExternalStore for tear-free reads of streaming state.
 */

import { useSyncExternalStore, useCallback } from 'react';
import type { StreamRouter } from '../core/StreamRouter';

const EMPTY_PLUGINS: string[] = [];

/**
 * Subscribe to a specific plugin's accumulated state.
 * Returns undefined if the plugin hasn't received any data yet.
 */
export function useStreamState<T = unknown>(
  router: StreamRouter | null,
  pluginId: string
): { state: T | undefined; isActive: boolean; isComplete: boolean } {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!router) return () => {};
      return router.subscribe(callback);
    },
    [router]
  );

  const getSnapshot = useCallback(() => {
    if (!router) return undefined;
    return router.getState<T>(pluginId);
  }, [router, pluginId]);

  const getIsActive = useCallback(() => {
    if (!router) return false;
    return router.isActive(pluginId);
  }, [router, pluginId]);

  const getIsComplete = useCallback(() => {
    if (!router) return false;
    return router.isComplete(pluginId);
  }, [router, pluginId]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isActive = useSyncExternalStore(subscribe, getIsActive, getIsActive);
  const isComplete = useSyncExternalStore(subscribe, getIsComplete, getIsComplete);

  return { state, isActive, isComplete };
}

/**
 * Subscribe to the list of active plugin IDs.
 * Useful for StreamDisplayPanel to know which renderers to show.
 */
export function useActivePlugins(router: StreamRouter | null): string[] {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!router) return () => {};
      return router.subscribe(callback);
    },
    [router]
  );

  const getSnapshot = useCallback(() => {
    if (!router) return EMPTY_PLUGINS;
    return router.getActivePluginIds();
  }, [router]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
