/**
 * StreamRouter - Dispatches parsed NDJSON lines to registered accumulators
 *
 * Maintains accumulator instances and a type-to-accumulator index for fast dispatch.
 * Supports multiple accumulators receiving the same line type (multi-stream).
 * Notifies subscribers on state changes via useSyncExternalStore-compatible API.
 */

import type { StreamLine, StreamAccumulator, StreamPlugin, StreamHooks, StreamSubscriber, StreamSnapshot } from './types';

interface ActiveAccumulator {
  plugin: StreamPlugin;
  accumulator: StreamAccumulator<unknown>;
  isActive: boolean;
}

export class StreamRouter {
  private accumulators = new Map<string, ActiveAccumulator>();
  private typeIndex = new Map<string, string[]>(); // lineType -> pluginId[]
  private subscribers = new Set<StreamSubscriber>();
  private hooks: StreamHooks;
  private version = 0; // Incremented on each state change

  // Snapshot caches - keyed by version to satisfy useSyncExternalStore referential equality
  private cachedActivePluginIds: string[] = [];
  private cachedActivePluginIdsVersion = -1;
  private cachedStates = new Map<string, { version: number; state: unknown }>();
  private cachedSnapshot: { version: number; snapshot: StreamSnapshot } = { version: -1, snapshot: {} };

  constructor(plugins: StreamPlugin[], hooks: StreamHooks = {}) {
    this.hooks = hooks;

    for (const plugin of plugins) {
      const accumulator = plugin.createAccumulator();
      this.accumulators.set(plugin.id, {
        plugin,
        accumulator,
        isActive: false,
      });

      // Build type index
      for (const lineType of plugin.lineTypes) {
        const existing = this.typeIndex.get(lineType) || [];
        existing.push(plugin.id);
        this.typeIndex.set(lineType, existing);
      }
    }
  }

  /** Route a parsed line to matching accumulators */
  route(line: StreamLine): void {
    this.hooks.onRawLine?.(line);

    const pluginIds = this.typeIndex.get(line.type);
    if (!pluginIds || pluginIds.length === 0) {
      this.hooks.onUnroutedLine?.(line);
      return;
    }

    let routed = false;

    for (const pluginId of pluginIds) {
      const entry = this.accumulators.get(pluginId);
      if (!entry) continue;

      if (entry.accumulator.accepts(line)) {
        entry.isActive = true;
        const state = entry.accumulator.processLine(line);
        routed = true;

        this.hooks.onAccumulatorUpdate?.(pluginId, state);

        if (entry.accumulator.isComplete()) {
          this.hooks.onAccumulatorComplete?.(pluginId, state);
        }
      }
    }

    if (!routed) {
      this.hooks.onUnroutedLine?.(line);
    }

    // Notify subscribers
    this.version++;
    this.notifySubscribers();
  }

  /** Get the current state of a specific accumulator (cached for useSyncExternalStore) */
  getState<T = unknown>(pluginId: string): T | undefined {
    const entry = this.accumulators.get(pluginId);
    if (!entry) return undefined;

    const cached = this.cachedStates.get(pluginId);
    if (cached && cached.version === this.version) {
      return cached.state as T | undefined;
    }

    const state = entry.accumulator.getState();
    this.cachedStates.set(pluginId, { version: this.version, state });
    return state as T | undefined;
  }

  /** Check if an accumulator has received any data */
  isActive(pluginId: string): boolean {
    return this.accumulators.get(pluginId)?.isActive ?? false;
  }

  /** Check if an accumulator is complete */
  isComplete(pluginId: string): boolean {
    return this.accumulators.get(pluginId)?.accumulator.isComplete() ?? false;
  }

  /** Get a snapshot of all accumulator states (cached for useSyncExternalStore) */
  getSnapshot(): StreamSnapshot {
    if (this.cachedSnapshot.version === this.version) {
      return this.cachedSnapshot.snapshot;
    }

    const snapshot: StreamSnapshot = {};
    for (const [id, entry] of this.accumulators) {
      snapshot[id] = {
        state: entry.accumulator.getState(),
        isComplete: entry.accumulator.isComplete(),
        isActive: entry.isActive,
      };
    }
    this.cachedSnapshot = { version: this.version, snapshot };
    return snapshot;
  }

  /** Get IDs of all active plugins (cached for useSyncExternalStore) */
  getActivePluginIds(): string[] {
    if (this.cachedActivePluginIdsVersion === this.version) {
      return this.cachedActivePluginIds;
    }

    const ids: string[] = [];
    for (const [id, entry] of this.accumulators) {
      if (entry.isActive) {
        ids.push(id);
      }
    }
    this.cachedActivePluginIds = ids;
    this.cachedActivePluginIdsVersion = this.version;
    return ids;
  }

  /** Get the plugin instance */
  getPlugin(pluginId: string): StreamPlugin | undefined {
    return this.accumulators.get(pluginId)?.plugin;
  }

  /** Reset all accumulators */
  reset(): void {
    for (const entry of this.accumulators.values()) {
      entry.accumulator.reset();
      entry.isActive = false;
    }
    this.version++;
    this.notifySubscribers();
  }

  /** Reset a specific accumulator */
  resetPlugin(pluginId: string): void {
    const entry = this.accumulators.get(pluginId);
    if (entry) {
      entry.accumulator.reset();
      entry.isActive = false;
      this.version++;
      this.notifySubscribers();
    }
  }

  /** Get current version (for useSyncExternalStore) */
  getVersion(): number {
    return this.version;
  }

  // --- useSyncExternalStore compatible API ---

  /** Subscribe to state changes */
  subscribe(callback: StreamSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }
}
