/**
 * Streaming JSON Lines (NDJSON) Parser for Project Creation
 *
 * Parses Claude's JSON Lines output progressively as it streams in.
 * Each line is a complete JSON object representing a project element.
 *
 * Architecture:
 * 1. Text streams in character-by-character
 * 2. Parser accumulates in buffer, splits by newlines
 * 3. Complete JSON lines are parsed and emitted as events
 * 4. State accumulator builds ProjectDraftData from events
 */

import type {
  ProjectLine,
  ProjectDraftData,
  TasklistDraft,
  TaskDraft,
  SubtaskDraft
} from '../types/conversation';

/**
 * Streaming JSON Lines parser
 * Accumulates text, splits by newlines, emits parsed ProjectLine events
 */
export class ProjectJsonParser {
  private buffer = '';
  private onEvent: (event: ProjectLine) => void;

  constructor(onEvent: (event: ProjectLine) => void) {
    this.onEvent = onEvent;
  }

  /**
   * Feed a text chunk into the parser
   * Processes complete lines and keeps incomplete ones in buffer
   */
  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');

    // Keep last line in buffer (might be incomplete)
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Process any remaining buffer content
   * Call this when the stream ends
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * Process a single line - parse if it's valid JSON
   */
  private processLine(line: string): void {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) return;

    // Only process lines that look like JSON objects
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      // This is thinking text or other non-JSON content - skip gracefully
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);

      // Validate it has a type field
      if (parsed && typeof parsed.type === 'string') {
        this.onEvent(parsed as ProjectLine);
      }
    } catch {
      // Not valid JSON - skip gracefully (might be thinking text that happens to start with {)
    }
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = '';
  }
}

/**
 * State accumulator that converts ProjectLine events into ProjectDraftData
 * Maintains the accumulated project structure as events stream in
 */
export class ProjectStateAccumulator {
  private draft: ProjectDraftData = {
    project: {
      name: '',
      tags: [],
    },
    tasklists: [],
    summary: {
      totalTasklists: 0,
      totalTasks: 0,
      totalSubtasks: 0,
    },
    message: '',
    isDraft: true,
  };

  private isBuilding = true;

  /**
   * Process a ProjectLine event and update the accumulated state
   * Returns the updated ProjectDraftData
   */
  processEvent(event: ProjectLine): ProjectDraftData {
    switch (event.type) {
      case 'project':
        this.draft.project = {
          name: event.name,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          tags: [],
        };
        // Set budget if budgetHours provided
        if (event.budgetHours) {
          this.draft.budget = {
            type: 'time',
            capacity: event.budgetHours,
          };
        }
        break;

      case 'tasklist':
        this.draft.tasklists.push({
          id: event.id,
          name: event.name,
          description: event.description,
          tasks: [],
        });
        this.draft.summary.totalTasklists = this.draft.tasklists.length;
        break;

      case 'task':
        // Find the tasklist and add the task
        const tasklist = this.draft.tasklists.find(tl => tl.id === event.tasklistId);
        if (tasklist) {
          tasklist.tasks.push({
            id: event.id,
            name: event.name,
            description: event.description,
            priority: this.normalizePriority(event.priority),
            estimatedMinutes: event.estimatedMinutes,
            tags: [],
            subtasks: [],
          });
          this.draft.summary.totalTasks = this.countTasks();
          this.draft.summary.totalMinutes = this.countTotalMinutes();
        }
        break;

      case 'subtask':
        // Find the task and add the subtask
        for (const tl of this.draft.tasklists) {
          const task = tl.tasks.find(t => t.id === event.taskId);
          if (task) {
            task.subtasks.push({
              id: `st-${Date.now()}-${task.subtasks.length}`,
              name: event.name,
              description: event.description,
              estimatedMinutes: event.estimatedMinutes,
            });
            this.draft.summary.totalSubtasks = this.countSubtasks();
            this.draft.summary.totalMinutes = this.countTotalMinutes();
            break;
          }
        }
        break;

      case 'complete':
        this.isBuilding = false;
        if (event.message) {
          this.draft.message = event.message;
        }
        break;
    }

    // Return a copy with building state
    return {
      ...this.draft,
      isBuilding: this.isBuilding,
    } as ProjectDraftData;
  }

  /**
   * Get the current draft state
   */
  getDraft(): ProjectDraftData {
    return {
      ...this.draft,
      isBuilding: this.isBuilding,
    } as ProjectDraftData;
  }

  /**
   * Check if building is complete
   */
  isComplete(): boolean {
    return !this.isBuilding;
  }

  /**
   * Reset the accumulator state
   */
  reset(): void {
    this.draft = {
      project: {
        name: '',
        tags: [],
      },
      tasklists: [],
      summary: {
        totalTasklists: 0,
        totalTasks: 0,
        totalSubtasks: 0,
      },
      message: '',
      isDraft: true,
    };
    this.isBuilding = true;
  }

  /**
   * Normalize priority value to expected format
   */
  private normalizePriority(priority?: string): 'none' | 'low' | 'medium' | 'high' {
    const normalized = (priority || 'none').toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
      return normalized;
    }
    return 'none';
  }

  /**
   * Count total tasks across all tasklists
   */
  private countTasks(): number {
    return this.draft.tasklists.reduce((sum, tl) => sum + tl.tasks.length, 0);
  }

  /**
   * Count total subtasks across all tasks
   */
  private countSubtasks(): number {
    return this.draft.tasklists.reduce(
      (sum, tl) => sum + tl.tasks.reduce((s, t) => s + t.subtasks.length, 0),
      0
    );
  }

  /**
   * Count total estimated minutes across all tasks and subtasks
   */
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

/**
 * Create a parser and accumulator pair for processing project JSON Lines
 * Returns handlers for the stream processing
 */
export function createProjectJsonLineProcessor(
  onDraftUpdate: (draft: ProjectDraftData) => void,
  onComplete: (draft: ProjectDraftData) => void
) {
  const accumulator = new ProjectStateAccumulator();

  const parser = new ProjectJsonParser((event) => {
    const draft = accumulator.processEvent(event);

    if (event.type === 'complete') {
      onComplete(draft);
    } else {
      onDraftUpdate(draft);
    }
  });

  return {
    parser,
    accumulator,
    feed: (chunk: string) => parser.feed(chunk),
    flush: () => parser.flush(),
    reset: () => {
      parser.reset();
      accumulator.reset();
    },
  };
}
