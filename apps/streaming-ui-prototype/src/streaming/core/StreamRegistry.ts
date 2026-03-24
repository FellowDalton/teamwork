import type { StreamPlugin } from './types';

class StreamRegistryImpl {
  private plugins = new Map<string, StreamPlugin>();

  register(plugin: StreamPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  get(id: string): StreamPlugin | undefined {
    return this.plugins.get(id);
  }

  getAll(): StreamPlugin[] {
    return Array.from(this.plugins.values());
  }

  getAllLineTypes(): string[] {
    const types = new Set<string>();
    for (const plugin of this.plugins.values()) {
      for (const type of plugin.lineTypes) types.add(type);
    }
    return Array.from(types);
  }

  buildDetectionPattern(): RegExp {
    const allTypes = this.getAllLineTypes();
    if (allTypes.length === 0) return /(?!)/;
    const escaped = allTypes.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\{"type"\\s*:\\s*"(${escaped.join('|')})"`);
  }

  clear(): void {
    this.plugins.clear();
  }
}

export const StreamRegistry = new StreamRegistryImpl();
