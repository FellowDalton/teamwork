import type { StreamLine, StreamAccumulator } from '../core/types';

export const PROJECT_LINE_TYPES = ['project', 'tasklist', 'task', 'subtask', 'complete'] as const;

export interface ProjectDraftData {
  project: { name: string; description?: string };
  tasklists: Array<{
    id: string;
    name: string;
    description?: string;
    tasks: Array<{
      id: string;
      name: string;
      description?: string;
      priority: string;
      estimatedMinutes?: number;
      subtasks: Array<{ id: string; name: string }>;
    }>;
  }>;
  summary: { totalTasklists: number; totalTasks: number; totalSubtasks: number; totalMinutes: number };
  message: string;
  isBuilding: boolean;
}

type ProjectLine = StreamLine & { type: typeof PROJECT_LINE_TYPES[number] };

export class ProjectAccumulator implements StreamAccumulator<ProjectDraftData, ProjectLine> {
  readonly id = 'project';
  readonly displayName = 'Project Draft';
  private draft: ProjectDraftData = this.initial();
  private building = true;

  accepts(line: StreamLine): line is ProjectLine {
    return (PROJECT_LINE_TYPES as readonly string[]).includes(line.type);
  }

  processLine(line: ProjectLine): ProjectDraftData {
    switch (line.type) {
      case 'project':
        this.draft.project = { name: line.name as string, description: line.description as string };
        break;
      case 'tasklist':
        this.draft.tasklists.push({
          id: line.id as string, name: line.name as string,
          description: line.description as string, tasks: [],
        });
        this.draft.summary.totalTasklists = this.draft.tasklists.length;
        break;
      case 'task': {
        const tl = this.draft.tasklists.find(t => t.id === line.tasklistId);
        if (tl) {
          tl.tasks.push({
            id: line.id as string, name: line.name as string,
            description: line.description as string,
            priority: (line.priority as string) || 'none',
            estimatedMinutes: line.estimatedMinutes as number,
            subtasks: [],
          });
          this.draft.summary.totalTasks = this.countTasks();
          this.draft.summary.totalMinutes = this.countMinutes();
        }
        break;
      }
      case 'subtask':
        for (const tl of this.draft.tasklists) {
          const task = tl.tasks.find(t => t.id === line.taskId);
          if (task) {
            task.subtasks.push({ id: `st-${Date.now()}-${task.subtasks.length}`, name: line.name as string });
            this.draft.summary.totalSubtasks = this.countSubtasks();
            break;
          }
        }
        break;
      case 'complete':
        this.building = false;
        if (line.message) this.draft.message = line.message as string;
        break;
    }
    return this.getState();
  }

  isComplete(): boolean { return !this.building; }

  getState(): ProjectDraftData {
    return { ...this.draft, isBuilding: this.building };
  }

  reset(): void {
    this.draft = this.initial();
    this.building = true;
  }

  private initial(): ProjectDraftData {
    return {
      project: { name: '' }, tasklists: [],
      summary: { totalTasklists: 0, totalTasks: 0, totalSubtasks: 0, totalMinutes: 0 },
      message: '', isBuilding: true,
    };
  }

  private countTasks(): number {
    return this.draft.tasklists.reduce((s, tl) => s + tl.tasks.length, 0);
  }
  private countSubtasks(): number {
    return this.draft.tasklists.reduce((s, tl) => s + tl.tasks.reduce((ss, t) => ss + t.subtasks.length, 0), 0);
  }
  private countMinutes(): number {
    let total = 0;
    for (const tl of this.draft.tasklists)
      for (const t of tl.tasks) total += t.estimatedMinutes || 0;
    return total;
  }
}
