/**
 * Unit tests for the Streaming JSON Lines Parser
 *
 * Tests cover:
 * - Parsing complete JSON lines
 * - Handling incomplete lines (buffering)
 * - Skipping thinking text (non-JSON content)
 * - Processing all event types (project, tasklist, task, subtask, complete)
 * - Edge cases: empty lines, malformed JSON, interleaved text
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ProjectJsonParser, ProjectStateAccumulator, createProjectJsonLineProcessor } from './projectJsonParser';
import type { ProjectLine, ProjectDraftData } from '../types/conversation';

describe('ProjectJsonParser', () => {
  let events: ProjectLine[];
  let parser: ProjectJsonParser;

  beforeEach(() => {
    events = [];
    parser = new ProjectJsonParser((event) => {
      events.push(event);
    });
  });

  describe('basic parsing', () => {
    it('should parse a complete JSON line', () => {
      parser.feed('{"type": "project", "name": "Test Project"}\n');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'project', name: 'Test Project' });
    });

    it('should parse multiple complete JSON lines', () => {
      parser.feed('{"type": "project", "name": "Test"}\n{"type": "tasklist", "id": "tl-1", "name": "Phase 1"}\n');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('project');
      expect(events[1].type).toBe('tasklist');
    });

    it('should parse JSON lines with optional fields', () => {
      parser.feed('{"type": "task", "id": "t-1", "tasklistId": "tl-1", "name": "Task", "priority": "high", "estimatedMinutes": 120}\n');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'task',
        id: 't-1',
        tasklistId: 'tl-1',
        name: 'Task',
        priority: 'high',
        estimatedMinutes: 120,
      });
    });
  });

  describe('buffering incomplete lines', () => {
    it('should buffer incomplete lines until newline received', () => {
      parser.feed('{"type": "project", "name": ');
      expect(events).toHaveLength(0);

      parser.feed('"Test Project"}\n');
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'project', name: 'Test Project' });
    });

    it('should handle chunks split mid-character', () => {
      parser.feed('{"type": "tasklist", "id": "tl-1", "name": "Des');
      parser.feed('ign Phase"}\n');

      expect(events).toHaveLength(1);
      expect((events[0] as any).name).toBe('Design Phase');
    });

    it('should flush remaining buffer content', () => {
      parser.feed('{"type": "complete"}');
      expect(events).toHaveLength(0);

      parser.flush();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('complete');
    });
  });

  describe('skipping non-JSON content', () => {
    it('should skip thinking text', () => {
      parser.feed('Let me think about this project structure...\n{"type": "project", "name": "Test"}\n');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('project');
    });

    it('should skip empty lines', () => {
      parser.feed('\n\n{"type": "project", "name": "Test"}\n\n');

      expect(events).toHaveLength(1);
    });

    it('should skip lines that look like JSON but are invalid', () => {
      parser.feed('{this is not valid json}\n{"type": "project", "name": "Test"}\n');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('project');
    });

    it('should skip markdown code blocks', () => {
      parser.feed('```json\n{"type": "project", "name": "Test"}\n```\n');

      // The code block markers are not JSON, but the content line is
      expect(events).toHaveLength(1);
    });

    it('should handle interleaved text and JSON', () => {
      parser.feed('Here is the project:\n');
      parser.feed('{"type": "project", "name": "Test"}\n');
      parser.feed('And here are the tasks:\n');
      parser.feed('{"type": "tasklist", "id": "tl-1", "name": "Phase 1"}\n');

      expect(events).toHaveLength(2);
    });
  });

  describe('all event types', () => {
    it('should parse project event', () => {
      parser.feed('{"type": "project", "name": "My Project", "description": "A test project"}\n');

      expect(events[0]).toEqual({
        type: 'project',
        name: 'My Project',
        description: 'A test project',
      });
    });

    it('should parse tasklist event', () => {
      parser.feed('{"type": "tasklist", "id": "tl-1", "name": "Planning", "description": "Initial planning"}\n');

      expect(events[0]).toEqual({
        type: 'tasklist',
        id: 'tl-1',
        name: 'Planning',
        description: 'Initial planning',
      });
    });

    it('should parse task event', () => {
      parser.feed('{"type": "task", "id": "t-1", "tasklistId": "tl-1", "name": "Research", "priority": "medium"}\n');

      expect(events[0]).toEqual({
        type: 'task',
        id: 't-1',
        tasklistId: 'tl-1',
        name: 'Research',
        priority: 'medium',
      });
    });

    it('should parse subtask event', () => {
      parser.feed('{"type": "subtask", "taskId": "t-1", "name": "Read docs", "description": "Review documentation"}\n');

      expect(events[0]).toEqual({
        type: 'subtask',
        taskId: 't-1',
        name: 'Read docs',
        description: 'Review documentation',
      });
    });

    it('should parse complete event', () => {
      parser.feed('{"type": "complete", "message": "Project structure ready"}\n');

      expect(events[0]).toEqual({
        type: 'complete',
        message: 'Project structure ready',
      });
    });
  });

  describe('reset', () => {
    it('should clear buffer on reset', () => {
      parser.feed('{"type": "project", "name": ');
      parser.reset();
      parser.feed('"Different"}\n');

      // Should not parse incomplete line from before reset
      expect(events).toHaveLength(0);
    });
  });
});

describe('ProjectStateAccumulator', () => {
  let accumulator: ProjectStateAccumulator;

  beforeEach(() => {
    accumulator = new ProjectStateAccumulator();
  });

  describe('project event', () => {
    it('should initialize project data', () => {
      const draft = accumulator.processEvent({
        type: 'project',
        name: 'Test Project',
        description: 'A test',
        startDate: '2024-01-01',
      });

      expect(draft.project.name).toBe('Test Project');
      expect(draft.project.description).toBe('A test');
      expect(draft.project.startDate).toBe('2024-01-01');
      expect(draft.isDraft).toBe(true);
    });
  });

  describe('tasklist event', () => {
    it('should add tasklist to draft', () => {
      accumulator.processEvent({ type: 'project', name: 'Test' });
      const draft = accumulator.processEvent({
        type: 'tasklist',
        id: 'tl-1',
        name: 'Phase 1',
        description: 'First phase',
      });

      expect(draft.tasklists).toHaveLength(1);
      expect(draft.tasklists[0].id).toBe('tl-1');
      expect(draft.tasklists[0].name).toBe('Phase 1');
      expect(draft.tasklists[0].tasks).toEqual([]);
      expect(draft.summary.totalTasklists).toBe(1);
    });
  });

  describe('task event', () => {
    it('should add task to correct tasklist', () => {
      accumulator.processEvent({ type: 'project', name: 'Test' });
      accumulator.processEvent({ type: 'tasklist', id: 'tl-1', name: 'Phase 1' });
      const draft = accumulator.processEvent({
        type: 'task',
        id: 't-1',
        tasklistId: 'tl-1',
        name: 'Task 1',
        priority: 'high',
      });

      expect(draft.tasklists[0].tasks).toHaveLength(1);
      expect(draft.tasklists[0].tasks[0].id).toBe('t-1');
      expect(draft.tasklists[0].tasks[0].priority).toBe('high');
      expect(draft.summary.totalTasks).toBe(1);
    });

    it('should normalize priority values', () => {
      accumulator.processEvent({ type: 'project', name: 'Test' });
      accumulator.processEvent({ type: 'tasklist', id: 'tl-1', name: 'Phase 1' });

      // Test various priority inputs
      accumulator.processEvent({ type: 'task', id: 't-1', tasklistId: 'tl-1', name: 'Task 1', priority: 'HIGH' });
      accumulator.processEvent({ type: 'task', id: 't-2', tasklistId: 'tl-1', name: 'Task 2', priority: 'invalid' });
      const draft = accumulator.processEvent({ type: 'task', id: 't-3', tasklistId: 'tl-1', name: 'Task 3' });

      expect(draft.tasklists[0].tasks[0].priority).toBe('high');
      expect(draft.tasklists[0].tasks[1].priority).toBe('none');
      expect(draft.tasklists[0].tasks[2].priority).toBe('none');
    });

    it('should ignore task for non-existent tasklist', () => {
      accumulator.processEvent({ type: 'project', name: 'Test' });
      const draft = accumulator.processEvent({
        type: 'task',
        id: 't-1',
        tasklistId: 'non-existent',
        name: 'Task 1',
      });

      expect(draft.summary.totalTasks).toBe(0);
    });
  });

  describe('subtask event', () => {
    it('should add subtask to correct task', () => {
      accumulator.processEvent({ type: 'project', name: 'Test' });
      accumulator.processEvent({ type: 'tasklist', id: 'tl-1', name: 'Phase 1' });
      accumulator.processEvent({ type: 'task', id: 't-1', tasklistId: 'tl-1', name: 'Task 1' });
      const draft = accumulator.processEvent({
        type: 'subtask',
        taskId: 't-1',
        name: 'Subtask 1',
      });

      expect(draft.tasklists[0].tasks[0].subtasks).toHaveLength(1);
      expect(draft.tasklists[0].tasks[0].subtasks[0].name).toBe('Subtask 1');
      expect(draft.summary.totalSubtasks).toBe(1);
    });
  });

  describe('complete event', () => {
    it('should mark building as complete', () => {
      accumulator.processEvent({ type: 'project', name: 'Test' });
      expect(accumulator.isComplete()).toBe(false);

      const draft = accumulator.processEvent({ type: 'complete', message: 'Done!' });

      expect(accumulator.isComplete()).toBe(true);
      expect(draft.message).toBe('Done!');
      expect((draft as any).isBuilding).toBe(false);
    });
  });

  describe('full workflow', () => {
    it('should build complete project structure', () => {
      // Build a realistic project
      accumulator.processEvent({
        type: 'project',
        name: 'Mobile App',
        description: 'Build a mobile application',
      });

      accumulator.processEvent({ type: 'tasklist', id: 'tl-1', name: 'Phase 1: Planning' });
      accumulator.processEvent({ type: 'task', id: 't-1', tasklistId: 'tl-1', name: 'Requirements gathering' });
      accumulator.processEvent({ type: 'subtask', taskId: 't-1', name: 'Stakeholder interviews' });
      accumulator.processEvent({ type: 'subtask', taskId: 't-1', name: 'Document requirements' });
      accumulator.processEvent({ type: 'task', id: 't-2', tasklistId: 'tl-1', name: 'Technical planning' });

      accumulator.processEvent({ type: 'tasklist', id: 'tl-2', name: 'Phase 2: Development' });
      accumulator.processEvent({ type: 'task', id: 't-3', tasklistId: 'tl-2', name: 'Setup environment', priority: 'high' });
      accumulator.processEvent({ type: 'task', id: 't-4', tasklistId: 'tl-2', name: 'Build features' });

      const draft = accumulator.processEvent({ type: 'complete', message: 'Project ready' });

      expect(draft.project.name).toBe('Mobile App');
      expect(draft.tasklists).toHaveLength(2);
      expect(draft.summary.totalTasklists).toBe(2);
      expect(draft.summary.totalTasks).toBe(4);
      expect(draft.summary.totalSubtasks).toBe(2);
      expect(draft.tasklists[0].tasks).toHaveLength(2);
      expect(draft.tasklists[1].tasks).toHaveLength(2);
      expect(draft.tasklists[0].tasks[0].subtasks).toHaveLength(2);
    });
  });
});

describe('createProjectJsonLineProcessor', () => {
  it('should create a working processor', () => {
    const updates: ProjectDraftData[] = [];
    let completedDraft: ProjectDraftData | null = null;

    const processor = createProjectJsonLineProcessor(
      (draft) => updates.push(draft),
      (draft) => { completedDraft = draft; }
    );

    processor.feed('{"type": "project", "name": "Test"}\n');
    processor.feed('{"type": "tasklist", "id": "tl-1", "name": "Phase 1"}\n');
    processor.feed('{"type": "complete"}\n');

    expect(updates.length).toBeGreaterThan(0);
    expect(completedDraft).not.toBeNull();
    expect(completedDraft!.project.name).toBe('Test');
  });

  it('should handle streaming chunks', () => {
    const updates: ProjectDraftData[] = [];
    const processor = createProjectJsonLineProcessor(
      (draft) => updates.push(draft),
      () => {}
    );

    // Simulate streaming chunks
    processor.feed('{"type": "pro');
    processor.feed('ject", "name"');
    processor.feed(': "Test"}\n');

    expect(updates).toHaveLength(1);
    expect(updates[0].project.name).toBe('Test');
  });
});
