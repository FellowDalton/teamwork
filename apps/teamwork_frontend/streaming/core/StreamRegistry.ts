/**
 * StreamRegistry - Singleton plugin registry
 *
 * Plugins register here on app startup. The registry provides
 * lookup by plugin ID and aggregated line type patterns for detection.
 */

import type { StreamPlugin } from './types';

class StreamRegistryImpl {
  private plugins = new Map<string, StreamPlugin>();

  /** Register a plugin */
  register(plugin: StreamPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`StreamRegistry: plugin "${plugin.id}" already registered, replacing`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  /** Unregister a plugin */
  unregister(id: string): void {
    this.plugins.delete(id);
  }

  /** Get a specific plugin by ID */
  get(id: string): StreamPlugin | undefined {
    return this.plugins.get(id);
  }

  /** Get all registered plugins */
  getAll(): StreamPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Get all registered line types across all plugins */
  getAllLineTypes(): string[] {
    const types = new Set<string>();
    for (const plugin of this.plugins.values()) {
      for (const type of plugin.lineTypes) {
        types.add(type);
      }
    }
    return Array.from(types);
  }

  /**
   * Build a detection regex from all registered plugins.
   * Used to detect whether a text chunk contains NDJSON lines
   * that any registered plugin can handle.
   */
  buildDetectionPattern(): RegExp {
    const allTypes = this.getAllLineTypes();
    if (allTypes.length === 0) {
      return /(?!)/; // Never matches
    }
    const escaped = allTypes.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\{"type"\\s*:\\s*"(${escaped.join('|')})"`);
  }

  /** Clear all registrations (useful for testing) */
  clear(): void {
    this.plugins.clear();
  }
}

/** Singleton instance */
export const StreamRegistry = new StreamRegistryImpl();
