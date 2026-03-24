import type { StreamLine, StreamPlugin, StreamSubscriber, StreamSnapshot } from './types';

interface ActiveAccumulator {
  plugin: StreamPlugin;
  accumulator: ReturnType<StreamPlugin['createAccumulator']>;
  isActive: boolean;
}

export class StreamRouter {
  private accumulators = new Map<string, ActiveAccumulator>();
  private typeIndex = new Map<string, string[]>();
  private subscribers = new Set<StreamSubscriber>();
  private version = 0;
  private cachedActivePluginIds: string[] = [];
  private cachedActivePluginIdsVersion = -1;
  private cachedStates = new Map<string, { version: number; state: unknown }>();

  constructor(plugins: StreamPlugin[]) {
    for (const plugin of plugins) {
      const accumulator = plugin.createAccumulator();
      this.accumulators.set(plugin.id, { plugin, accumulator, isActive: false });
      for (const lineType of plugin.lineTypes) {
        const existing = this.typeIndex.get(lineType) || [];
        existing.push(plugin.id);
        this.typeIndex.set(lineType, existing);
      }
    }
  }

  route(line: StreamLine): void {
    const pluginIds = this.typeIndex.get(line.type);
    if (!pluginIds || pluginIds.length === 0) return;

    for (const pluginId of pluginIds) {
      const entry = this.accumulators.get(pluginId);
      if (!entry) continue;
      if (entry.accumulator.accepts(line)) {
        entry.isActive = true;
        entry.accumulator.processLine(line);
      }
    }

    this.version++;
    this.notifySubscribers();
  }

  getState<T = unknown>(pluginId: string): T | undefined {
    const entry = this.accumulators.get(pluginId);
    if (!entry) return undefined;
    const cached = this.cachedStates.get(pluginId);
    if (cached && cached.version === this.version) return cached.state as T;
    const state = entry.accumulator.getState();
    this.cachedStates.set(pluginId, { version: this.version, state });
    return state as T;
  }

  isActive(pluginId: string): boolean {
    return this.accumulators.get(pluginId)?.isActive ?? false;
  }

  isComplete(pluginId: string): boolean {
    return this.accumulators.get(pluginId)?.accumulator.isComplete() ?? false;
  }

  getActivePluginIds(): string[] {
    if (this.cachedActivePluginIdsVersion === this.version) return this.cachedActivePluginIds;
    const ids: string[] = [];
    for (const [id, entry] of this.accumulators) {
      if (entry.isActive) ids.push(id);
    }
    this.cachedActivePluginIds = ids;
    this.cachedActivePluginIdsVersion = this.version;
    return ids;
  }

  getPlugin(pluginId: string): StreamPlugin | undefined {
    return this.accumulators.get(pluginId)?.plugin;
  }

  reset(): void {
    for (const entry of this.accumulators.values()) {
      entry.accumulator.reset();
      entry.isActive = false;
    }
    this.version++;
    this.notifySubscribers();
  }

  subscribe(callback: StreamSubscriber): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) subscriber();
  }
}
