/**
 * TimelogAccumulator - Accumulates timelog draft NDJSON lines
 *
 * Handles streaming timelog entries from Claude's thinking output.
 * The agent outputs NDJSON lines (timelog_entry, timelog_summary, timelog_complete)
 * which are streamed through the backend as thinking events and parsed here.
 */

import type { StreamLine, StreamAccumulator } from '../core/types';
import type { TimelogDraftData, TimelogDraftEntry } from '../../types/conversation';

/** NDJSON line types for timelog streaming */
export const TIMELOG_LINE_TYPES = [
  'timelog_entry',
  'timelog_summary',
  'timelog_complete',
] as const;

type TimelogLineType = typeof TIMELOG_LINE_TYPES[number];

export type TimelogLine =
  | {
      type: 'timelog_entry';
      id: string;
      taskId: number;
      taskName: string;
      projectId: number;
      projectName: string;
      hours: number;
      date: string;
      comment: string;
      confidence: number;
      isBillable: boolean;
    }
  | {
      type: 'timelog_summary';
      totalHours: number;
      totalEntries: number;
      dateRange: string;
    }
  | {
      type: 'timelog_complete';
      message?: string;
    };

function isTimelogLine(line: StreamLine): line is TimelogLine {
  return TIMELOG_LINE_TYPES.includes(line.type as TimelogLineType);
}

export class TimelogAccumulator implements StreamAccumulator<TimelogDraftData, TimelogLine> {
  readonly id = 'timelog';
  readonly displayName = 'Time Log Draft';

  private entries: TimelogDraftEntry[] = [];
  private summary = { totalHours: 0, totalEntries: 0, dateRange: '' };
  private message = '';
  private complete = false;
  private isBuilding = false;

  accepts(line: StreamLine): line is TimelogLine {
    return isTimelogLine(line);
  }

  processLine(line: TimelogLine): TimelogDraftData {
    switch (line.type) {
      case 'timelog_entry':
        this.isBuilding = true;
        this.entries.push({
          id: line.id,
          taskId: line.taskId,
          taskName: line.taskName,
          projectId: line.projectId,
          projectName: line.projectName,
          hours: line.hours,
          date: line.date,
          comment: line.comment,
          confidence: line.confidence,
          isBillable: line.isBillable,
        });
        // Update running totals
        this.summary.totalEntries = this.entries.length;
        this.summary.totalHours = this.entries.reduce((sum, e) => sum + e.hours, 0);
        break;

      case 'timelog_summary':
        this.summary = {
          totalHours: line.totalHours,
          totalEntries: line.totalEntries,
          dateRange: line.dateRange,
        };
        break;

      case 'timelog_complete':
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

  getState(): TimelogDraftData {
    return {
      entries: [...this.entries],
      summary: { ...this.summary },
      message: this.message,
      isDraft: true,
      isBuilding: this.isBuilding,
    };
  }

  reset(): void {
    this.entries = [];
    this.summary = { totalHours: 0, totalEntries: 0, dateRange: '' };
    this.message = '';
    this.complete = false;
    this.isBuilding = false;
  }
}
