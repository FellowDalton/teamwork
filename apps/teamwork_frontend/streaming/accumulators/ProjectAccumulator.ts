/**
 * ProjectAccumulator - Extracted from ProjectStateAccumulator
 *
 * Accumulates NDJSON project lines into ProjectDraftData.
 * Implements the StreamAccumulator interface for the streaming framework.
 */

import type { StreamLine, StreamAccumulator } from '../core/types';
import type {
  ProjectDraftData,
  ProjectLine,
} from '../../types/conversation';

/** All NDJSON type names this accumulator handles */
export const PROJECT_LINE_TYPES = ['project', 'tasklist', 'task', 'subtask', 'complete'] as const;

type ProjectLineType = typeof PROJECT_LINE_TYPES[number];

function isProjectLine(line: StreamLine): line is ProjectLine {
  return PROJECT_LINE_TYPES.includes(line.type as ProjectLineType);
}

export class ProjectAccumulator implements StreamAccumulator<ProjectDraftData, ProjectLine> {
  readonly id = 'project';
  readonly displayName = 'Project Draft';

  private draft: ProjectDraftData = this.createInitialState();
  private isBuilding = true;

  accepts(line: StreamLine): line is ProjectLine {
    return isProjectLine(line);
  }

  processLine(line: ProjectLine): ProjectDraftData {
    switch (line.type) {
      case 'project':
        this.draft.project = {
          name: line.name,
          description: line.description,
          startDate: line.startDate,
          endDate: line.endDate,
          tags: [],
        };
        if (line.budgetHours) {
          this.draft.budget = {
            type: 'time',
            capacity: line.budgetHours,
          };
        }
        break;

      case 'tasklist':
        this.draft.tasklists.push({
          id: line.id,
          name: line.name,
          description: line.description,
          tasks: [],
        });
        this.draft.summary.totalTasklists = this.draft.tasklists.length;
        break;

      case 'task': {
        const tasklist = this.draft.tasklists.find(tl => tl.id === line.tasklistId);
        if (tasklist) {
          tasklist.tasks.push({
            id: line.id,
            name: line.name,
            description: line.description,
            priority: this.normalizePriority(line.priority),
            estimatedMinutes: line.estimatedMinutes,
            tags: [],
            subtasks: [],
          });
          this.draft.summary.totalTasks = this.countTasks();
          this.draft.summary.totalMinutes = this.countTotalMinutes();
        }
        break;
      }

      case 'subtask':
        for (const tl of this.draft.tasklists) {
          const task = tl.tasks.find(t => t.id === line.taskId);
          if (task) {
            task.subtasks.push({
              id: `st-${Date.now()}-${task.subtasks.length}`,
              name: line.name,
              description: line.description,
              estimatedMinutes: line.estimatedMinutes,
            });
            this.draft.summary.totalSubtasks = this.countSubtasks();
            this.draft.summary.totalMinutes = this.countTotalMinutes();
            break;
          }
        }
        break;

      case 'complete':
        this.isBuilding = false;
        if (line.message) {
          this.draft.message = line.message;
        }
        break;
    }

    return this.getState();
  }

  isComplete(): boolean {
    return !this.isBuilding;
  }

  getState(): ProjectDraftData {
    return {
      ...this.draft,
      isBuilding: this.isBuilding,
    } as ProjectDraftData;
  }

  reset(): void {
    this.draft = this.createInitialState();
    this.isBuilding = true;
  }

  private createInitialState(): ProjectDraftData {
    return {
      project: { name: '', tags: [] },
      tasklists: [],
      summary: { totalTasklists: 0, totalTasks: 0, totalSubtasks: 0 },
      message: '',
      isDraft: true,
    };
  }

  private normalizePriority(priority?: string): 'none' | 'low' | 'medium' | 'high' {
    const normalized = (priority || 'none').toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
      return normalized;
    }
    return 'none';
  }

  private countTasks(): number {
    return this.draft.tasklists.reduce((sum, tl) => sum + tl.tasks.length, 0);
  }

  private countSubtasks(): number {
    return this.draft.tasklists.reduce(
      (sum, tl) => sum + tl.tasks.reduce((s, t) => s + t.subtasks.length, 0),
      0
    );
  }

  private countTotalMinutes(): number {
    let total = 0;
    for (const tl of this.draft.tasklists) {
      for (const task of tl.tasks) {
        total += task.estimatedMinutes || 0;
        for (const subtask of task.subtasks) {
          total += subtask.estimatedMinutes || 0;
        }
      }
    }
    return total;
  }
}
