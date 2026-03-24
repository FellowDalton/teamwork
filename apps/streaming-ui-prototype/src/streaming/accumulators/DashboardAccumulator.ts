import type { StreamLine, StreamAccumulator } from '../core/types';

export const DASHBOARD_LINE_TYPES = [
  'dashboard_meta', 'dashboard_metric', 'dashboard_chart', 'dashboard_activity', 'dashboard_complete',
] as const;

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DashboardChart {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie';
  data: Array<{ label: string; value: number }>;
}

export interface DashboardActivity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

export interface DashboardState {
  title: string;
  description: string;
  metrics: DashboardMetric[];
  charts: DashboardChart[];
  activities: DashboardActivity[];
  isBuilding: boolean;
}

type DashLine = StreamLine & { type: typeof DASHBOARD_LINE_TYPES[number] };

export class DashboardAccumulator implements StreamAccumulator<DashboardState, DashLine> {
  readonly id = 'dashboard';
  readonly displayName = 'Live Dashboard';
  private state: DashboardState = this.initial();
  private building = true;

  accepts(line: StreamLine): line is DashLine {
    return (DASHBOARD_LINE_TYPES as readonly string[]).includes(line.type);
  }

  processLine(line: DashLine): DashboardState {
    switch (line.type) {
      case 'dashboard_meta':
        this.state.title = line.title as string;
        this.state.description = line.description as string;
        break;
      case 'dashboard_metric':
        this.state.metrics.push({
          id: `m-${this.state.metrics.length}`,
          label: line.label as string,
          value: line.value as string,
          change: line.change as string,
          trend: line.trend as 'up' | 'down' | 'neutral',
        });
        break;
      case 'dashboard_chart':
        this.state.charts.push({
          id: `c-${this.state.charts.length}`,
          title: line.title as string,
          type: (line.chartType as 'bar' | 'line' | 'pie') || 'bar',
          data: (line.data as Array<{ label: string; value: number }>) || [],
        });
        break;
      case 'dashboard_activity':
        this.state.activities.push({
          id: `a-${this.state.activities.length}`,
          user: line.user as string,
          action: line.action as string,
          timestamp: line.timestamp as string,
        });
        break;
      case 'dashboard_complete':
        this.building = false;
        break;
    }
    return this.getState();
  }

  isComplete(): boolean { return !this.building; }

  getState(): DashboardState {
    return { ...this.state, isBuilding: this.building };
  }

  reset(): void {
    this.state = this.initial();
    this.building = true;
  }

  private initial(): DashboardState {
    return {
      title: '', description: '', metrics: [], charts: [], activities: [], isBuilding: true,
    };
  }
}
