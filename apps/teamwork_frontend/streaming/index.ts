/**
 * Streaming Framework - Barrel Export
 *
 * Pluggable NDJSON streaming system for real-time data display.
 */

// Core
export { NdjsonParser } from './core/NdjsonParser';
export { StreamRouter } from './core/StreamRouter';
export { StreamRegistry } from './core/StreamRegistry';
export type {
  StreamLine,
  StreamAccumulator,
  StreamPlugin,
  StreamRendererProps,
  StreamHooks,
  StreamSubscriber,
  StreamSnapshot,
} from './core/types';

// Accumulators
export { ProjectAccumulator, PROJECT_LINE_TYPES } from './accumulators/ProjectAccumulator';
export { TimelogAccumulator, TIMELOG_LINE_TYPES } from './accumulators/TimelogAccumulator';
export { WebsiteAccumulator, WEBSITE_LINE_TYPES } from './accumulators/WebsiteAccumulator';
export type { WebsiteDraftState, WebsitePage, WebsiteSection } from './accumulators/WebsiteAccumulator';
export { StatusAccumulator, STATUS_LINE_TYPES } from './accumulators/StatusAccumulator';
export type { StatusDraftState, StatusSection, StatusMetric, StatusTask, StatusChart } from './accumulators/StatusAccumulator';
export { GeneralAccumulator, GENERAL_LINE_TYPES } from './accumulators/GeneralAccumulator';
export type { GeneralDraftState, GeneralTaskItem } from './accumulators/GeneralAccumulator';

// Hooks & Context
export { StreamProvider, useStreamContext, useOptionalStreamContext } from './hooks/StreamContext';
export { useStreamState, useActivePlugins } from './hooks/useStreamState';

// Renderers
export { StreamDisplayPanel } from './renderers/StreamDisplayPanel';

// Plugin registration
export { registerBuiltinPlugins, setRenderers, projectPlugin, timelogPlugin, websitePlugin, statusPlugin, generalPlugin } from './plugins';
