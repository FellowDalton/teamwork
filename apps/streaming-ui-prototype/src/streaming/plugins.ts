import { StreamRegistry } from './core/StreamRegistry';
import type { StreamPlugin } from './core/types';
import { ProjectAccumulator, PROJECT_LINE_TYPES, type ProjectDraftData } from './accumulators/ProjectAccumulator';
import { DashboardAccumulator, DASHBOARD_LINE_TYPES, type DashboardState } from './accumulators/DashboardAccumulator';
import { ProjectRenderer } from './renderers/ProjectRenderer';
import { DashboardRenderer } from './renderers/DashboardRenderer';

export const projectPlugin: StreamPlugin<ProjectDraftData> = {
  id: 'project',
  displayName: 'Project Draft',
  lineTypes: [...PROJECT_LINE_TYPES],
  createAccumulator: () => new ProjectAccumulator(),
  Renderer: ProjectRenderer as React.ComponentType<any>,
};

export const dashboardPlugin: StreamPlugin<DashboardState> = {
  id: 'dashboard',
  displayName: 'Live Dashboard',
  lineTypes: [...DASHBOARD_LINE_TYPES],
  createAccumulator: () => new DashboardAccumulator(),
  Renderer: DashboardRenderer as React.ComponentType<any>,
};

export function registerPlugins(): void {
  StreamRegistry.register(projectPlugin);
  StreamRegistry.register(dashboardPlugin);
}
