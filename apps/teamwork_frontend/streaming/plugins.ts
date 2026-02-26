/**
 * Plugin Registration
 *
 * Registers all built-in stream plugins with the StreamRegistry.
 * Called once on app startup.
 */

import { StreamRegistry } from './core/StreamRegistry';
import type { StreamPlugin } from './core/types';
import type { ProjectDraftData } from '../types/conversation';
import type { TimelogDraftData } from '../types/conversation';
import type { WebsiteDraftState } from './accumulators/WebsiteAccumulator';

import { ProjectAccumulator, PROJECT_LINE_TYPES } from './accumulators/ProjectAccumulator';
import { TimelogAccumulator, TIMELOG_LINE_TYPES } from './accumulators/TimelogAccumulator';
import { WebsiteAccumulator, WEBSITE_LINE_TYPES } from './accumulators/WebsiteAccumulator';
import { StatusAccumulator, STATUS_LINE_TYPES } from './accumulators/StatusAccumulator';
import { GeneralAccumulator, GENERAL_LINE_TYPES } from './accumulators/GeneralAccumulator';
import type { StatusDraftState } from './accumulators/StatusAccumulator';
import type { GeneralDraftState } from './accumulators/GeneralAccumulator';

// Lazy import renderers to avoid circular dependency issues
// Renderers are React components that will be set after import
let ProjectDraftRenderer: React.ComponentType<any> | null = null;
let TimelogDraftRenderer: React.ComponentType<any> | null = null;
let WebsiteRenderer: React.ComponentType<any> | null = null;
let StatusRenderer: React.ComponentType<any> | null = null;
let GeneralRenderer: React.ComponentType<any> | null = null;

// Placeholder component that renders nothing until real renderer is loaded
const Placeholder: React.ComponentType<any> = () => null;

/** Project creation plugin */
export const projectPlugin: StreamPlugin<ProjectDraftData> = {
  id: 'project',
  displayName: 'Project Draft',
  lineTypes: [...PROJECT_LINE_TYPES],
  createAccumulator: () => new ProjectAccumulator(),
  get Renderer() {
    return ProjectDraftRenderer || Placeholder;
  },
};

/** Timelog draft plugin */
export const timelogPlugin: StreamPlugin<TimelogDraftData> = {
  id: 'timelog',
  displayName: 'Time Log Draft',
  lineTypes: [...TIMELOG_LINE_TYPES],
  createAccumulator: () => new TimelogAccumulator(),
  get Renderer() {
    return TimelogDraftRenderer || Placeholder;
  },
};

/** Website builder skeleton plugin */
export const websitePlugin: StreamPlugin<WebsiteDraftState> = {
  id: 'website',
  displayName: 'Website Builder',
  lineTypes: [...WEBSITE_LINE_TYPES],
  createAccumulator: () => new WebsiteAccumulator(),
  get Renderer() {
    return WebsiteRenderer || Placeholder;
  },
};

/** Status dashboard plugin */
export const statusPlugin: StreamPlugin<StatusDraftState> = {
  id: 'status',
  displayName: 'Status Dashboard',
  lineTypes: [...STATUS_LINE_TYPES],
  createAccumulator: () => new StatusAccumulator(),
  get Renderer() {
    return StatusRenderer || Placeholder;
  },
};

/** General chat plugin */
export const generalPlugin: StreamPlugin<GeneralDraftState> = {
  id: 'general',
  displayName: 'General Tasks',
  lineTypes: [...GENERAL_LINE_TYPES],
  createAccumulator: () => new GeneralAccumulator(),
  get Renderer() {
    return GeneralRenderer || Placeholder;
  },
};

/** Register all built-in plugins */
export function registerBuiltinPlugins(): void {
  StreamRegistry.register(projectPlugin);
  StreamRegistry.register(timelogPlugin);
  StreamRegistry.register(websitePlugin);
  StreamRegistry.register(statusPlugin);
  StreamRegistry.register(generalPlugin);
}

/** Set the renderer components (called after lazy import) */
export function setRenderers(renderers: {
  ProjectDraftRenderer?: React.ComponentType<any>;
  TimelogDraftRenderer?: React.ComponentType<any>;
  WebsiteRenderer?: React.ComponentType<any>;
  StatusRenderer?: React.ComponentType<any>;
  GeneralRenderer?: React.ComponentType<any>;
}): void {
  if (renderers.ProjectDraftRenderer) ProjectDraftRenderer = renderers.ProjectDraftRenderer;
  if (renderers.TimelogDraftRenderer) TimelogDraftRenderer = renderers.TimelogDraftRenderer;
  if (renderers.WebsiteRenderer) WebsiteRenderer = renderers.WebsiteRenderer;
  if (renderers.StatusRenderer) StatusRenderer = renderers.StatusRenderer;
  if (renderers.GeneralRenderer) GeneralRenderer = renderers.GeneralRenderer;
}
