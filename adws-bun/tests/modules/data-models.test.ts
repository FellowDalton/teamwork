/**
 * Test suite for data-models module
 */

import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  // System Tags
  SystemTag,
  getWorkflowTags,
  getModelTags,
  extractModelFromTags,
  extractWorkflowFromTags,
  // Task Models
  TaskSchema,
  isTaskEligibleForPickup,
  isTaskCompleted,
  WorktreeSchema,
  getEligibleTasks,
  hasTasksToProcess,
  TaskUpdateSchema,
  // Workflow State
  WorkflowStateSchema,
  markWorkflowCompleted,
  // Configuration
  CronTriggerConfigSchema,
  WorktreeConfigSchema,
  // Notion Models
  NotionTaskSchema,
  isNotionTaskEligibleForProcessing,
  extractNotionAppContext,
  getNotionPreferredModel,
  shouldNotionTaskUseFullWorkflow,
  NotionTaskUpdateSchema,
  NotionWorkflowStateSchema,
  markNotionWorkflowCompleted,
  getNotionWorkflowDuration,
  calculateNotionSuccessRate,
  calculateNotionApiSuccessRate,
  NotionCronConfigSchema,
  // Teamwork Models
  TeamworkTaskSchema,
  isTeamworkTaskEligibleForProcessing,
  extractTeamworkTagsFromDescription,
  getTeamworkTaskPromptForAgent,
  extractTeamworkAppContext,
  getTeamworkPreferredModel,
  shouldTeamworkTaskUseFullWorkflow,
  TeamworkTaskUpdateSchema,
  formatTeamworkComment,
  TeamworkCronConfigSchema,
  mapStatusToTeamwork,
  mapStatusFromTeamwork,
  getReverseStatusMapping,
  TeamworkWorkflowStateSchema,
  markTeamworkWorkflowCompleted,
  getTeamworkWorkflowDuration,
  calculateTeamworkSuccessRate,
  calculateTeamworkApiSuccessRate,
  WorktreeCreationRequestSchema,
  generateWorktreeNameArgs,
  // Enums
  RetryCode,
} from '@/modules/data-models';

describe('data-models', () => {
  describe('RetryCode enum', () => {
    it('should have correct values', () => {
      expect(RetryCode.CLAUDE_CODE_ERROR).toBe('claude_code_error');
      expect(RetryCode.TIMEOUT_ERROR).toBe('timeout_error');
      expect(RetryCode.EXECUTION_ERROR).toBe('execution_error');
      expect(RetryCode.ERROR_DURING_EXECUTION).toBe('error_during_execution');
      expect(RetryCode.NONE).toBe('none');
    });
  });

  describe('SystemTag', () => {
    it('should have correct tag values', () => {
      expect(SystemTag.PLAN_IMPLEMENT_UPDATE).toBe('adw_plan_implement_update_task');
      expect(SystemTag.OPUS).toBe('opus');
      expect(SystemTag.SONNET).toBe('sonnet');
    });

    it('should return workflow tags', () => {
      const tags = getWorkflowTags();
      expect(tags).toContain('adw_plan_implement_update_task');
      expect(tags).toHaveLength(1);
    });

    it('should return model tags', () => {
      const tags = getModelTags();
      expect(tags).toContain('opus');
      expect(tags).toContain('sonnet');
      expect(tags).toHaveLength(2);
    });
  });

  describe('extractModelFromTags', () => {
    it('should extract opus model', () => {
      expect(extractModelFromTags(['opus'])).toBe('opus');
    });

    it('should extract sonnet model', () => {
      expect(extractModelFromTags(['sonnet'])).toBe('sonnet');
    });

    it('should prioritize opus over sonnet', () => {
      expect(extractModelFromTags(['sonnet', 'opus'])).toBe('opus');
    });

    it('should return null when no model tags', () => {
      expect(extractModelFromTags(['other', 'tags'])).toBeNull();
    });

    it('should return null for empty array', () => {
      expect(extractModelFromTags([])).toBeNull();
    });
  });

  describe('extractWorkflowFromTags', () => {
    it('should return true for plan workflow tag', () => {
      expect(extractWorkflowFromTags(['adw_plan_implement_update_task'])).toBe(true);
    });

    it('should return false for other tags', () => {
      expect(extractWorkflowFromTags(['other', 'tags'])).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(extractWorkflowFromTags([])).toBe(false);
    });
  });

  describe('TaskSchema validation', () => {
    it('should validate valid task', () => {
      const task = {
        description: 'Test task',
        status: '[]' as const,
        tags: ['test'],
      };
      expect(() => TaskSchema.parse(task)).not.toThrow();
    });

    it('should apply default status', () => {
      const task = TaskSchema.parse({ description: 'Test' });
      expect(task.status).toBe('[]');
    });

    it('should apply default tags', () => {
      const task = TaskSchema.parse({ description: 'Test' });
      expect(task.tags).toEqual([]);
    });

    it('should accept all valid statuses', () => {
      const statuses = ['[]', '[⏰]', '[🟡]', '[✅]', '[❌]'] as const;
      statuses.forEach((status) => {
        const task = { description: 'Test', status };
        expect(() => TaskSchema.parse(task)).not.toThrow();
      });
    });

    it('should reject invalid status', () => {
      const task = { description: 'Test', status: 'invalid' };
      expect(() => TaskSchema.parse(task)).toThrow();
    });

    it('should accept optional fields', () => {
      const task = {
        description: 'Test',
        adw_id: 'abc12345',
        commit_hash: 'abc123',
        worktree_name: 'feat-test',
      };
      expect(() => TaskSchema.parse(task)).not.toThrow();
    });
  });

  describe('isTaskEligibleForPickup', () => {
    it('should return true for [] status', () => {
      const task = TaskSchema.parse({ description: 'Test', status: '[]' });
      expect(isTaskEligibleForPickup(task)).toBe(true);
    });

    it('should return true for [⏰] status', () => {
      const task = TaskSchema.parse({ description: 'Test', status: '[⏰]' });
      expect(isTaskEligibleForPickup(task)).toBe(true);
    });

    it('should return false for completed status', () => {
      const task = TaskSchema.parse({ description: 'Test', status: '[✅]' });
      expect(isTaskEligibleForPickup(task)).toBe(false);
    });

    it('should return false for failed status', () => {
      const task = TaskSchema.parse({ description: 'Test', status: '[❌]' });
      expect(isTaskEligibleForPickup(task)).toBe(false);
    });
  });

  describe('isTaskCompleted', () => {
    it('should return true for success status', () => {
      const task = TaskSchema.parse({ description: 'Test', status: '[✅]' });
      expect(isTaskCompleted(task)).toBe(true);
    });

    it('should return true for failed status', () => {
      const task = TaskSchema.parse({ description: 'Test', status: '[❌]' });
      expect(isTaskCompleted(task)).toBe(true);
    });

    it('should return false for in-progress status', () => {
      const task = TaskSchema.parse({ description: 'Test', status: '[🟡]' });
      expect(isTaskCompleted(task)).toBe(false);
    });
  });

  describe('WorktreeSchema validation', () => {
    it('should validate valid worktree', () => {
      const worktree = {
        name: 'feat-test',
        tasks: [{ description: 'Task 1' }],
      };
      expect(() => WorktreeSchema.parse(worktree)).not.toThrow();
    });

    it('should apply default tasks', () => {
      const worktree = WorktreeSchema.parse({ name: 'feat-test' });
      expect(worktree.tasks).toEqual([]);
    });
  });

  describe('getEligibleTasks', () => {
    it('should return non-blocked tasks', () => {
      const worktree = WorktreeSchema.parse({
        name: 'test',
        tasks: [
          { description: 'Task 1', status: '[]' },
          { description: 'Task 2', status: '[]' },
        ],
      });
      const eligible = getEligibleTasks(worktree);
      expect(eligible).toHaveLength(2);
    });

    it('should not return blocked tasks when previous incomplete', () => {
      const worktree = WorktreeSchema.parse({
        name: 'test',
        tasks: [
          { description: 'Task 1', status: '[]' },
          { description: 'Task 2', status: '[⏰]' },
        ],
      });
      const eligible = getEligibleTasks(worktree);
      expect(eligible).toHaveLength(1);
      expect(eligible[0]?.description).toBe('Task 1');
    });

    it('should return blocked tasks when all above successful', () => {
      const worktree = WorktreeSchema.parse({
        name: 'test',
        tasks: [
          { description: 'Task 1', status: '[✅]' },
          { description: 'Task 2', status: '[⏰]' },
        ],
      });
      const eligible = getEligibleTasks(worktree);
      expect(eligible).toHaveLength(1);
      expect(eligible[0]?.description).toBe('Task 2');
    });

    it('should handle empty task list', () => {
      const worktree = WorktreeSchema.parse({ name: 'test', tasks: [] });
      const eligible = getEligibleTasks(worktree);
      expect(eligible).toHaveLength(0);
    });
  });

  describe('hasTasksToProcess', () => {
    it('should return true when tasks exist', () => {
      const response = {
        task_groups: [
          {
            worktree_name: 'test',
            tasks_to_start: [{ description: 'Task 1', tags: [] }],
          },
        ],
      };
      expect(hasTasksToProcess(response)).toBe(true);
    });

    it('should return false when no tasks', () => {
      const response = {
        task_groups: [
          {
            worktree_name: 'test',
            tasks_to_start: [],
          },
        ],
      };
      expect(hasTasksToProcess(response)).toBe(false);
    });

    it('should return false when empty task groups', () => {
      const response = { task_groups: [] };
      expect(hasTasksToProcess(response)).toBe(false);
    });
  });

  describe('TaskUpdateSchema validation', () => {
    it('should validate successful update with commit hash', () => {
      const update = {
        adw_id: 'abc12345',
        status: '[✅]' as const,
        commit_hash: 'abc123',
        worktree_name: 'feat-test',
        task_description: 'Test task',
      };
      expect(() => TaskUpdateSchema.parse(update)).not.toThrow();
    });

    it('should validate failed update with error message', () => {
      const update = {
        adw_id: 'abc12345',
        status: '[❌]' as const,
        error_message: 'Build failed',
        worktree_name: 'feat-test',
        task_description: 'Test task',
      };
      expect(() => TaskUpdateSchema.parse(update)).not.toThrow();
    });

    it('should reject successful update without commit hash', () => {
      const update = {
        adw_id: 'abc12345',
        status: '[✅]' as const,
        worktree_name: 'feat-test',
        task_description: 'Test task',
      };
      expect(() => TaskUpdateSchema.parse(update)).toThrow();
    });
  });

  describe('WorkflowStateSchema validation', () => {
    it('should validate valid workflow state', () => {
      const state = {
        adw_id: 'abc12345',
        worktree_name: 'feat-test',
        task_description: 'Test task',
        phase: 'planning' as const,
      };
      expect(() => WorkflowStateSchema.parse(state)).not.toThrow();
    });

    it('should apply default started_at', () => {
      const state = WorkflowStateSchema.parse({
        adw_id: 'abc12345',
        worktree_name: 'feat-test',
        task_description: 'Test task',
        phase: 'planning' as const,
      });
      expect(state.started_at).toBeInstanceOf(Date);
    });

    it('should accept all valid phases', () => {
      const phases = ['planning', 'implementing', 'updating', 'completed', 'failed'] as const;
      phases.forEach((phase) => {
        const state = {
          adw_id: 'abc12345',
          worktree_name: 'test',
          task_description: 'Test',
          phase,
        };
        expect(() => WorkflowStateSchema.parse(state)).not.toThrow();
      });
    });
  });

  describe('markWorkflowCompleted', () => {
    it('should mark workflow as completed on success', () => {
      const state = WorkflowStateSchema.parse({
        adw_id: 'abc12345',
        worktree_name: 'test',
        task_description: 'Test',
        phase: 'implementing' as const,
      });
      const completed = markWorkflowCompleted(state, true);
      expect(completed.phase).toBe('completed');
      expect(completed.completed_at).toBeInstanceOf(Date);
    });

    it('should mark workflow as failed on error', () => {
      const state = WorkflowStateSchema.parse({
        adw_id: 'abc12345',
        worktree_name: 'test',
        task_description: 'Test',
        phase: 'implementing' as const,
      });
      const failed = markWorkflowCompleted(state, false, 'Build error');
      expect(failed.phase).toBe('failed');
      expect(failed.error).toBe('Build error');
    });
  });

  describe('CronTriggerConfigSchema validation', () => {
    it('should validate with defaults', () => {
      const config = CronTriggerConfigSchema.parse({});
      expect(config.polling_interval).toBe(5);
      expect(config.max_concurrent_tasks).toBe(5);
      expect(config.dry_run).toBe(false);
    });

    it('should reject invalid polling interval', () => {
      expect(() => CronTriggerConfigSchema.parse({ polling_interval: 0 })).toThrow();
      expect(() => CronTriggerConfigSchema.parse({ polling_interval: -1 })).toThrow();
    });
  });

  describe('Notion task models', () => {
    describe('NotionTaskSchema validation', () => {
      it('should validate minimal notion task', () => {
        const task = {
          page_id: 'page-123',
          title: 'Test task',
          status: 'Not started' as const,
        };
        expect(() => NotionTaskSchema.parse(task)).not.toThrow();
      });

      it('should accept all valid statuses', () => {
        const statuses = ['Not started', 'In progress', 'Done', 'HIL Review', 'Failed'] as const;
        statuses.forEach((status) => {
          const task = { page_id: 'page-123', title: 'Test', status };
          expect(() => NotionTaskSchema.parse(task)).not.toThrow();
        });
      });
    });

    describe('isNotionTaskEligibleForProcessing', () => {
      it('should return true for Not started with execute trigger', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          execution_trigger: 'execute',
        });
        expect(isNotionTaskEligibleForProcessing(task)).toBe(true);
      });

      it('should return true for HIL Review with continue trigger', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'HIL Review' as const,
          execution_trigger: 'continue',
        });
        expect(isNotionTaskEligibleForProcessing(task)).toBe(true);
      });

      it('should return false without execution trigger', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
        });
        expect(isNotionTaskEligibleForProcessing(task)).toBe(false);
      });
    });

    describe('extractNotionAppContext', () => {
      it('should extract app tag', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          tags: { app: 'my-app' },
        });
        expect(extractNotionAppContext(task)).toBe('my-app');
      });

      it('should return undefined when no app tag', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
        });
        expect(extractNotionAppContext(task)).toBeUndefined();
      });
    });

    describe('getNotionPreferredModel', () => {
      it('should use model field', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          model: 'opus',
        });
        expect(getNotionPreferredModel(task)).toBe('opus');
      });

      it('should use tags.model', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          tags: { model: 'opus' },
        });
        expect(getNotionPreferredModel(task)).toBe('opus');
      });

      it('should default to sonnet', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
        });
        expect(getNotionPreferredModel(task)).toBe('sonnet');
      });

      it('should reject invalid model values', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          model: 'invalid',
        });
        expect(getNotionPreferredModel(task)).toBe('sonnet');
      });
    });

    describe('shouldNotionTaskUseFullWorkflow', () => {
      it('should return true for workflow_type plan', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          workflow_type: 'plan',
        });
        expect(shouldNotionTaskUseFullWorkflow(task)).toBe(true);
      });

      it('should return true for tags.workflow plan', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          tags: { workflow: 'plan' },
        });
        expect(shouldNotionTaskUseFullWorkflow(task)).toBe(true);
      });

      it('should return true for long task prompts', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          task_prompt: 'a'.repeat(501),
        });
        expect(shouldNotionTaskUseFullWorkflow(task)).toBe(true);
      });

      it('should return false for short tasks without workflow tag', () => {
        const task = NotionTaskSchema.parse({
          page_id: '123',
          title: 'Test',
          status: 'Not started' as const,
          task_prompt: 'short task',
        });
        expect(shouldNotionTaskUseFullWorkflow(task)).toBe(false);
      });
    });

    describe('markNotionWorkflowCompleted', () => {
      it('should mark as completed with commit hash', () => {
        const state = NotionWorkflowStateSchema.parse({
          adw_id: 'abc123',
          page_id: 'page-123',
          worktree_name: 'test',
          task_description: 'Test',
          workflow_type: 'build_update' as const,
          phase: 'implementing' as const,
          model: 'sonnet',
        });
        const completed = markNotionWorkflowCompleted(state, true, undefined, 'commit123');
        expect(completed.phase).toBe('completed');
        expect(completed.commit_hash).toBe('commit123');
      });
    });

    describe('getNotionWorkflowDuration', () => {
      it('should calculate duration', () => {
        const state = NotionWorkflowStateSchema.parse({
          adw_id: 'abc123',
          page_id: 'page-123',
          worktree_name: 'test',
          task_description: 'Test',
          workflow_type: 'build_update' as const,
          phase: 'implementing' as const,
          model: 'sonnet',
        });
        const completed = markNotionWorkflowCompleted(state);
        const duration = getNotionWorkflowDuration(completed);
        expect(duration).toBeGreaterThanOrEqual(0);
      });

      it('should return null for incomplete workflow', () => {
        const state = NotionWorkflowStateSchema.parse({
          adw_id: 'abc123',
          page_id: 'page-123',
          worktree_name: 'test',
          task_description: 'Test',
          workflow_type: 'build_update' as const,
          phase: 'implementing' as const,
          model: 'sonnet',
        });
        expect(getNotionWorkflowDuration(state)).toBeNull();
      });
    });

    describe('calculateNotionSuccessRate', () => {
      it('should calculate success rate', () => {
        const metrics = {
          tasks_processed: 10,
          tasks_completed: 8,
          tasks_failed: 2,
          average_processing_time: 60.0,
          notion_api_calls: 50,
          notion_api_errors: 2,
          worktrees_created: 10,
          last_reset: new Date(),
        };
        expect(calculateNotionSuccessRate(metrics)).toBe(80.0);
      });

      it('should return 0 for no tasks', () => {
        const metrics = {
          tasks_processed: 0,
          tasks_completed: 0,
          tasks_failed: 0,
          average_processing_time: 0.0,
          notion_api_calls: 0,
          notion_api_errors: 0,
          worktrees_created: 0,
          last_reset: new Date(),
        };
        expect(calculateNotionSuccessRate(metrics)).toBe(0.0);
      });
    });

    describe('calculateNotionApiSuccessRate', () => {
      it('should calculate API success rate', () => {
        const metrics = {
          tasks_processed: 10,
          tasks_completed: 8,
          tasks_failed: 2,
          average_processing_time: 60.0,
          notion_api_calls: 50,
          notion_api_errors: 5,
          worktrees_created: 10,
          last_reset: new Date(),
        };
        expect(calculateNotionApiSuccessRate(metrics)).toBe(90.0);
      });

      it('should return 100 for no API calls', () => {
        const metrics = {
          tasks_processed: 0,
          tasks_completed: 0,
          tasks_failed: 0,
          average_processing_time: 0.0,
          notion_api_calls: 0,
          notion_api_errors: 0,
          worktrees_created: 0,
          last_reset: new Date(),
        };
        expect(calculateNotionApiSuccessRate(metrics)).toBe(100.0);
      });
    });
  });

  describe('Teamwork task models', () => {
    describe('TeamworkTaskSchema validation', () => {
      it('should validate minimal teamwork task', () => {
        const task = {
          task_id: 'task-123',
          project_id: 'proj-456',
          title: 'Test task',
          status: 'New',
        };
        expect(() => TeamworkTaskSchema.parse(task)).not.toThrow();
      });
    });

    describe('isTeamworkTaskEligibleForProcessing', () => {
      it('should return true for new status with execute trigger', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'New',
          execution_trigger: 'execute',
        });
        expect(isTeamworkTaskEligibleForProcessing(task)).toBe(true);
      });

      it('should be case-insensitive for status', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'NEW',
          execution_trigger: 'execute',
        });
        expect(isTeamworkTaskEligibleForProcessing(task)).toBe(true);
      });

      it('should accept to do status', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'to do',
          execution_trigger: 'execute',
        });
        expect(isTeamworkTaskEligibleForProcessing(task)).toBe(true);
      });

      it('should accept review status', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'review',
          execution_trigger: 'continue',
        });
        expect(isTeamworkTaskEligibleForProcessing(task)).toBe(true);
      });
    });

    describe('extractTeamworkTagsFromDescription', () => {
      it('should extract single tag', () => {
        const desc = 'Test task {{app: my-app}}';
        const tags = extractTeamworkTagsFromDescription(desc);
        expect(tags.app).toBe('my-app');
      });

      it('should extract multiple tags', () => {
        const desc = 'Test {{app: my-app}} and {{model: opus}}';
        const tags = extractTeamworkTagsFromDescription(desc);
        expect(tags.app).toBe('my-app');
        expect(tags.model).toBe('opus');
      });

      it('should handle tags with spaces', () => {
        const desc = 'Test {{worktree:   feat-auth  }}';
        const tags = extractTeamworkTagsFromDescription(desc);
        expect(tags.worktree).toBe('feat-auth');
      });

      it('should return empty object for no tags', () => {
        const desc = 'Test task without tags';
        const tags = extractTeamworkTagsFromDescription(desc);
        expect(Object.keys(tags)).toHaveLength(0);
      });
    });

    describe('getTeamworkTaskPromptForAgent', () => {
      it('should use task_prompt for continue trigger', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'Review',
          description: 'Original description {{app: my-app}}',
          execution_trigger: 'continue',
          task_prompt: 'Continue with fixes',
        });
        expect(getTeamworkTaskPromptForAgent(task)).toBe('Continue with fixes');
      });

      it('should clean description for execute trigger', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'New',
          description: 'Build feature {{app: my-app}} execute',
          execution_trigger: 'execute',
        });
        const prompt = getTeamworkTaskPromptForAgent(task);
        expect(prompt).toBe('Build feature');
      });

      it('should remove inline tags', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'New',
          description: 'Task {{model: opus}} {{app: test}} execute',
          execution_trigger: 'execute',
        });
        const prompt = getTeamworkTaskPromptForAgent(task);
        expect(prompt).toBe('Task');
      });
    });

    describe('extractTeamworkAppContext', () => {
      it('should extract app tag', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'New',
          tags: { app: 'my-app' },
        });
        expect(extractTeamworkAppContext(task)).toBe('my-app');
      });
    });

    describe('getTeamworkPreferredModel', () => {
      it('should use model field', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'New',
          model: 'opus',
        });
        expect(getTeamworkPreferredModel(task)).toBe('opus');
      });

      it('should default to sonnet', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'New',
        });
        expect(getTeamworkPreferredModel(task)).toBe('sonnet');
      });
    });

    describe('shouldTeamworkTaskUseFullWorkflow', () => {
      it('should return true for long task prompts', () => {
        const task = TeamworkTaskSchema.parse({
          task_id: '123',
          project_id: '456',
          title: 'Test',
          status: 'New',
          task_prompt: 'a'.repeat(501),
        });
        expect(shouldTeamworkTaskUseFullWorkflow(task)).toBe(true);
      });
    });

    describe('formatTeamworkComment', () => {
      it('should format comment with status', () => {
        const update = TeamworkTaskUpdateSchema.parse({
          task_id: '123',
          status: 'In Progress',
          update_type: 'status' as const,
          adw_id: 'abc123',
        });
        const comment = formatTeamworkComment(update);
        expect(comment).toContain('In Progress');
        expect(comment).toContain('abc123');
      });

      it('should include commit hash when present', () => {
        const update = TeamworkTaskUpdateSchema.parse({
          task_id: '123',
          status: 'Complete',
          update_type: 'completion' as const,
          commit_hash: 'abc123',
        });
        const comment = formatTeamworkComment(update);
        expect(comment).toContain('Commit Hash');
        expect(comment).toContain('abc123');
      });

      it('should include error message when present', () => {
        const update = TeamworkTaskUpdateSchema.parse({
          task_id: '123',
          status: 'Failed',
          update_type: 'error' as const,
          error_message: 'Build failed',
        });
        const comment = formatTeamworkComment(update);
        expect(comment).toContain('Error');
        expect(comment).toContain('Build failed');
      });
    });

    describe('TeamworkCronConfigSchema validation', () => {
      it('should validate with defaults', () => {
        const config = TeamworkCronConfigSchema.parse({
          project_id: '12345',
        });
        expect(config.polling_interval).toBe(15);
        expect(config.max_concurrent_tasks).toBe(3);
        expect(config.default_model).toBe('sonnet');
      });

      it('should have default status mapping', () => {
        const config = TeamworkCronConfigSchema.parse({
          project_id: '12345',
        });
        expect(config.status_mapping['Not started']).toBe('New');
        expect(config.status_mapping['In progress']).toBe('In Progress');
        expect(config.status_mapping['Done']).toBe('Complete');
      });
    });

    describe('mapStatusToTeamwork', () => {
      it('should map system status to teamwork status', () => {
        const config = TeamworkCronConfigSchema.parse({
          project_id: '12345',
        });
        expect(mapStatusToTeamwork(config, 'Not started')).toBe('New');
        expect(mapStatusToTeamwork(config, 'In progress')).toBe('In Progress');
        expect(mapStatusToTeamwork(config, 'Done')).toBe('Complete');
      });

      it('should return original if no mapping', () => {
        const config = TeamworkCronConfigSchema.parse({
          project_id: '12345',
        });
        expect(mapStatusToTeamwork(config, 'Unknown')).toBe('Unknown');
      });
    });

    describe('mapStatusFromTeamwork', () => {
      it('should map teamwork status to system status', () => {
        const config = TeamworkCronConfigSchema.parse({
          project_id: '12345',
        });
        expect(mapStatusFromTeamwork(config, 'New')).toBe('Not started');
        expect(mapStatusFromTeamwork(config, 'In Progress')).toBe('In progress');
        expect(mapStatusFromTeamwork(config, 'Complete')).toBe('Done');
      });
    });

    describe('getReverseStatusMapping', () => {
      it('should create reverse mapping', () => {
        const config = TeamworkCronConfigSchema.parse({
          project_id: '12345',
        });
        const reverse = getReverseStatusMapping(config);
        expect(reverse['New']).toBe('Not started');
        expect(reverse['Complete']).toBe('Done');
      });
    });

    describe('markTeamworkWorkflowCompleted', () => {
      it('should mark as completed', () => {
        const state = TeamworkWorkflowStateSchema.parse({
          adw_id: 'abc123',
          task_id: 'task-123',
          project_id: 'proj-456',
          worktree_name: 'test',
          task_description: 'Test',
          workflow_type: 'build_update' as const,
          phase: 'implementing' as const,
          model: 'sonnet',
        });
        const completed = markTeamworkWorkflowCompleted(state, true, undefined, 'commit123');
        expect(completed.phase).toBe('completed');
        expect(completed.commit_hash).toBe('commit123');
      });
    });

    describe('getTeamworkWorkflowDuration', () => {
      it('should calculate duration', () => {
        const state = TeamworkWorkflowStateSchema.parse({
          adw_id: 'abc123',
          task_id: 'task-123',
          project_id: 'proj-456',
          worktree_name: 'test',
          task_description: 'Test',
          workflow_type: 'build_update' as const,
          phase: 'implementing' as const,
          model: 'sonnet',
        });
        const completed = markTeamworkWorkflowCompleted(state);
        const duration = getTeamworkWorkflowDuration(completed);
        expect(duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('calculateTeamworkSuccessRate', () => {
      it('should calculate success rate', () => {
        const metrics = {
          tasks_processed: 10,
          tasks_completed: 7,
          tasks_failed: 3,
          average_processing_time: 60.0,
          teamwork_api_calls: 50,
          teamwork_api_errors: 5,
          worktrees_created: 10,
          last_reset: new Date(),
        };
        expect(calculateTeamworkSuccessRate(metrics)).toBe(70.0);
      });
    });

    describe('calculateTeamworkApiSuccessRate', () => {
      it('should calculate API success rate', () => {
        const metrics = {
          tasks_processed: 10,
          tasks_completed: 7,
          tasks_failed: 3,
          average_processing_time: 60.0,
          teamwork_api_calls: 50,
          teamwork_api_errors: 5,
          worktrees_created: 10,
          last_reset: new Date(),
        };
        expect(calculateTeamworkApiSuccessRate(metrics)).toBe(90.0);
      });
    });
  });

  describe('WorktreeCreationRequestSchema', () => {
    it('should validate minimal request', () => {
      const request = {
        task_description: 'Build new feature',
      };
      expect(() => WorktreeCreationRequestSchema.parse(request)).not.toThrow();
    });

    it('should apply default base_branch', () => {
      const request = WorktreeCreationRequestSchema.parse({
        task_description: 'Test',
      });
      expect(request.base_branch).toBe('main');
    });
  });

  describe('generateWorktreeNameArgs', () => {
    it('should generate args array', () => {
      const request = WorktreeCreationRequestSchema.parse({
        task_description: 'Build feature',
        app_context: 'my-app',
        prefix: 'feat',
      });
      const args = generateWorktreeNameArgs(request);
      expect(args).toEqual(['Build feature', 'my-app', 'feat']);
    });

    it('should use empty strings for missing optional fields', () => {
      const request = WorktreeCreationRequestSchema.parse({
        task_description: 'Build feature',
      });
      const args = generateWorktreeNameArgs(request);
      expect(args).toEqual(['Build feature', '', '']);
    });
  });
});
