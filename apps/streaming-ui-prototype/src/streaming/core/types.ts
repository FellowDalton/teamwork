/** Base type for all NDJSON lines - must have a type discriminator */
export interface StreamLine {
  type: string;
  [key: string]: unknown;
}

/** StreamAccumulator - plugin contract for accumulating state from stream lines */
export interface StreamAccumulator<TState, TLine extends StreamLine = StreamLine> {
  readonly id: string;
  readonly displayName: string;
  accepts(line: StreamLine): line is TLine;
  processLine(line: TLine): TState;
  isComplete(): boolean;
  getState(): TState;
  reset(): void;
}

/** Props passed to every stream renderer component */
export interface StreamRendererProps<TState> {
  state: TState;
}

/** StreamPlugin - bundles an accumulator with its React renderer */
export interface StreamPlugin<TState = unknown> {
  readonly id: string;
  readonly displayName: string;
  readonly lineTypes: string[];
  createAccumulator(): StreamAccumulator<TState>;
  Renderer: React.ComponentType<StreamRendererProps<TState>>;
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
