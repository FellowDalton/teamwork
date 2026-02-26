/**
 * Generic Stream Framework Types
 *
 * Core abstractions for the pluggable NDJSON streaming system.
 * Any flow (project creation, timelog drafts, website building, etc.)
 * implements these interfaces to participate in the stream pipeline.
 */

/** Base type for all NDJSON lines - must have a type discriminator */
export interface StreamLine {
  type: string;
  [key: string]: unknown;
}

/**
 * StreamAccumulator - the plugin contract for accumulating state from stream lines.
 *
 * Each flow implements this to process incoming NDJSON lines and build up
 * domain-specific state (e.g., ProjectDraftData, TimelogDraftData, WebsiteDraftState).
 */
export interface StreamAccumulator<TState, TLine extends StreamLine = StreamLine> {
  /** Unique identifier for this accumulator */
  readonly id: string;
  /** Human-readable name */
  readonly displayName: string;
  /** Type guard: does this accumulator handle this line type? */
  accepts(line: StreamLine): line is TLine;
  /** Process a line and update internal state. Returns updated state. */
  processLine(line: TLine): TState;
  /** Is the stream complete for this accumulator? */
  isComplete(): boolean;
  /** Get current accumulated state */
  getState(): TState;
  /** Reset to initial state */
  reset(): void;
}

/** Props passed to every stream renderer component */
export interface StreamRendererProps<TState> {
  state: TState;
  theme?: 'light' | 'dark';
}

/**
 * StreamPlugin - bundles an accumulator with its React renderer.
 * This is what gets registered with the StreamRegistry.
 */
export interface StreamPlugin<TState = unknown> {
  /** Unique plugin identifier */
  readonly id: string;
  /** Human-readable name */
  readonly displayName: string;
  /** Which NDJSON type names this plugin handles (for fast router indexing) */
  readonly lineTypes: string[];
  /** Factory to create a fresh accumulator instance */
  createAccumulator(): StreamAccumulator<TState>;
  /** React component that renders the accumulated state */
  Renderer: React.ComponentType<StreamRendererProps<TState>>;
}

/** Hooks to tap into the stream at various points */
export interface StreamHooks {
  /** Called for every parsed line before routing */
  onRawLine?: (line: StreamLine) => void;
  /** Called after an accumulator processes a line */
  onAccumulatorUpdate?: (pluginId: string, state: unknown) => void;
  /** Called when an accumulator signals completion */
  onAccumulatorComplete?: (pluginId: string, state: unknown) => void;
  /** Called for lines no accumulator claimed */
  onUnroutedLine?: (line: StreamLine) => void;
}

/** Subscriber callback type for state changes */
export type StreamSubscriber = () => void;

/** Snapshot of all active accumulator states */
export interface StreamSnapshot {
  [pluginId: string]: {
    state: unknown;
    isComplete: boolean;
    isActive: boolean;
  };
}
