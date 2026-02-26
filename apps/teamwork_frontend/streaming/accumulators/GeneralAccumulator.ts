/**
 * GeneralAccumulator - Accumulates general mode NDJSON lines
 *
 * Handles task creation output from the general Teamwork agent.
 */

import type { StreamLine, StreamAccumulator } from '../core/types';

export const GENERAL_LINE_TYPES = ['general_task', 'general_complete'] as const;
type GeneralLineType = typeof GENERAL_LINE_TYPES[number];

export interface GeneralTaskItem {
  id: string;
  taskId?: number;
  name: string;
  description: string;
  projectId?: number;
  projectName?: string;
  tasklistId?: number;
  tasklistName?: string;
  priority?: 'none' | 'low' | 'medium' | 'high';
  startDate?: string;
  dueDate?: string;
  estimatedMinutes?: number;
}

export interface GeneralDraftState {
  tasks: GeneralTaskItem[];
  message: string;
  isBuilding: boolean;
}

export type GeneralLine =
  | {
      type: 'general_task';
      id?: string;
      taskId?: number;
      name: string;
      description?: string;
      projectId?: number;
      projectName?: string;
      tasklistId?: number;
      tasklistName?: string;
      priority?: 'none' | 'low' | 'medium' | 'high';
      startDate?: string;
      dueDate?: string;
      estimatedMinutes?: number;
      [key: string]: unknown;
    }
  | {
      type: 'general_complete';
      message?: string;
      [key: string]: unknown;
    };

function isGeneralLine(line: StreamLine): line is GeneralLine {
  return GENERAL_LINE_TYPES.includes(line.type as GeneralLineType);
}

export class GeneralAccumulator implements StreamAccumulator<GeneralDraftState, GeneralLine> {
  readonly id = 'general';
  readonly displayName = 'General Tasks';

  private tasks: GeneralTaskItem[] = [];
  private message = '';
  private complete = false;
  private isBuilding = false;

  accepts(line: StreamLine): line is GeneralLine {
    return isGeneralLine(line);
  }

  processLine(line: GeneralLine): GeneralDraftState {
    switch (line.type) {
      case 'general_task':
        this.isBuilding = true;
        this.tasks.push({
          id: line.id || `task-${line.taskId || Date.now()}`,
          taskId: line.taskId,
          name: line.name,
          description: line.description || '',
          projectId: line.projectId,
          projectName: line.projectName,
          tasklistId: line.tasklistId,
          tasklistName: line.tasklistName,
          priority: line.priority,
          startDate: line.startDate,
          dueDate: line.dueDate,
          estimatedMinutes: line.estimatedMinutes,
        });
        break;
      case 'general_complete':
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

  getState(): GeneralDraftState {
    return {
      tasks: [...this.tasks],
      message: this.message,
      isBuilding: this.isBuilding,
    };
  }

  reset(): void {
    this.tasks = [];
    this.message = '';
    this.complete = false;
    this.isBuilding = false;
  }
}
