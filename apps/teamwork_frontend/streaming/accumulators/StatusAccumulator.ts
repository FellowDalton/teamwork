/**
 * StatusAccumulator - Accumulates status dashboard NDJSON lines
 *
 * Handles streaming status data (metrics, tasks, charts) from the status agent.
 * The agent outputs NDJSON lines which are streamed through the backend as
 * thinking events and parsed here into section-based state.
 */

import type { StreamLine, StreamAccumulator } from '../core/types';

/** NDJSON line types for status streaming */
export const STATUS_LINE_TYPES = [
  'status_section',
  'status_metric',
  'status_task',
  'status_chart',
  'status_complete',
] as const;

type StatusLineType = typeof STATUS_LINE_TYPES[number];

// --- Data Interfaces ---

export interface StatusMetric {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: 'cyan' | 'green' | 'orange' | 'red' | 'purple' | 'blue';
}

export interface StatusTask {
  id: string;
  name: string;
  status: string;
  priority?: string;
  assignee?: string;
  progress?: number;
  estimatedHours?: number;
  loggedHours?: number;
}

export interface StatusChart {
  id: string;
  chartType: 'bar' | 'line';
  title: string;
  data: Array<{ label: string; value: number }>;
  summary?: { total?: number; average?: number };
}

export interface StatusSection {
  id: string;
  title: string;
  category: 'metrics' | 'tasks' | 'time' | 'dashboard';
  metrics: StatusMetric[];
  tasks: StatusTask[];
  charts: StatusChart[];
}

export interface StatusDraftState {
  sections: StatusSection[];
  isBuilding: boolean;
  message: string;
}

// --- Line Types ---

export type StatusLine =
  | {
      type: 'status_section';
      id: string;
      title: string;
      category: 'metrics' | 'tasks' | 'time' | 'dashboard';
      [key: string]: unknown;
    }
  | {
      type: 'status_metric';
      sectionId?: string;
      id: string;
      label: string;
      value: string | number;
      subValue?: string;
      trend?: 'up' | 'down' | 'stable';
      color?: 'cyan' | 'green' | 'orange' | 'red' | 'purple' | 'blue';
      [key: string]: unknown;
    }
  | {
      type: 'status_task';
      sectionId?: string;
      id: string;
      name: string;
      status: string;
      priority?: string;
      assignee?: string;
      progress?: number;
      estimatedHours?: number;
      loggedHours?: number;
      [key: string]: unknown;
    }
  | {
      type: 'status_chart';
      sectionId?: string;
      id: string;
      chartType: 'bar' | 'line';
      title: string;
      data: Array<{ label: string; value: number }>;
      summary?: { total?: number; average?: number };
      [key: string]: unknown;
    }
  | {
      type: 'status_complete';
      message?: string;
      [key: string]: unknown;
    };

function isStatusLine(line: StreamLine): line is StatusLine {
  return STATUS_LINE_TYPES.includes(line.type as StatusLineType);
}

export class StatusAccumulator implements StreamAccumulator<StatusDraftState, StatusLine> {
  readonly id = 'status';
  readonly displayName = 'Status Dashboard';

  private sections: StatusSection[] = [];
  private message = '';
  private complete = false;
  private isBuilding = false;

  accepts(line: StreamLine): line is StatusLine {
    return isStatusLine(line);
  }

  private findSection(sectionId?: string): StatusSection | undefined {
    if (sectionId) {
      return this.sections.find(s => s.id === sectionId);
    }
    // Fall back to last section
    return this.sections[this.sections.length - 1];
  }

  private ensureDefaultSection(): StatusSection {
    if (this.sections.length === 0) {
      const defaultSection: StatusSection = {
        id: 'sec-default',
        title: 'Overview',
        category: 'dashboard',
        metrics: [],
        tasks: [],
        charts: [],
      };
      this.sections.push(defaultSection);
      return defaultSection;
    }
    return this.sections[this.sections.length - 1];
  }

  processLine(line: StatusLine): StatusDraftState {
    switch (line.type) {
      case 'status_section':
        this.isBuilding = true;
        this.sections.push({
          id: line.id,
          title: line.title,
          category: line.category,
          metrics: [],
          tasks: [],
          charts: [],
        });
        break;

      case 'status_metric': {
        this.isBuilding = true;
        const section = this.findSection(line.sectionId) || this.ensureDefaultSection();
        section.metrics.push({
          id: line.id,
          label: line.label,
          value: line.value,
          subValue: line.subValue,
          trend: line.trend,
          color: line.color,
        });
        break;
      }

      case 'status_task': {
        this.isBuilding = true;
        const section = this.findSection(line.sectionId) || this.ensureDefaultSection();
        section.tasks.push({
          id: line.id,
          name: line.name,
          status: line.status,
          priority: line.priority,
          assignee: line.assignee,
          progress: line.progress,
          estimatedHours: line.estimatedHours,
          loggedHours: line.loggedHours,
        });
        break;
      }

      case 'status_chart': {
        this.isBuilding = true;
        const section = this.findSection(line.sectionId) || this.ensureDefaultSection();
        section.charts.push({
          id: line.id,
          chartType: line.chartType,
          title: line.title,
          data: line.data,
          summary: line.summary,
        });
        break;
      }

      case 'status_complete':
        this.complete = true;
        this.isBuilding = false;
        if (line.message) {
          this.message = line.message;
        }
        break;
    }

    return this.getState();
  }

  isComplete(): boolean {
    return this.complete;
  }

  getState(): StatusDraftState {
    return {
      sections: this.sections.map(s => ({
        ...s,
        metrics: [...s.metrics],
        tasks: [...s.tasks],
        charts: [...s.charts],
      })),
      isBuilding: this.isBuilding,
      message: this.message,
    };
  }

  reset(): void {
    this.sections = [];
    this.message = '';
    this.complete = false;
    this.isBuilding = false;
  }
}
