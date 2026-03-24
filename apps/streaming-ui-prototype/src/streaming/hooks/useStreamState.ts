import { useSyncExternalStore, useCallback } from 'react';
import type { StreamRouter } from '../core/StreamRouter';

const EMPTY_PLUGINS: string[] = [];

export function useStreamState<T = unknown>(
  router: StreamRouter | null,
  pluginId: string
): { state: T | undefined; isActive: boolean; isComplete: boolean } {
  const subscribe = useCallback(
    (cb: () => void) => router ? router.subscribe(cb) : () => {},
    [router]
  );
  const getState = useCallback(
    () => router ? router.getState<T>(pluginId) : undefined,
    [router, pluginId]
  );
  const getIsActive = useCallback(
    () => router ? router.isActive(pluginId) : false,
    [router, pluginId]
  );
  const getIsComplete = useCallback(
    () => router ? router.isComplete(pluginId) : false,
    [router, pluginId]
  );

  const state = useSyncExternalStore(subscribe, getState, getState);
  const isActive = useSyncExternalStore(subscribe, getIsActive, getIsActive);
  const isComplete = useSyncExternalStore(subscribe, getIsComplete, getIsComplete);

  return { state, isActive, isComplete };
}

export function useActivePlugins(router: StreamRouter | null): string[] {
  const subscribe = useCallback(
    (cb: () => void) => router ? router.subscribe(cb) : () => {},
    [router]
  );
  const getSnapshot = useCallback(
    () => router ? router.getActivePluginIds() : EMPTY_PLUGINS,
    [router]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
