/**
 * Tests for the TimeEntriesResource module.
 */

import { describe, test, expect } from 'bun:test';
import {
  TimeEntrySchema,
  TimeEntryListResponseSchema,
  TimeEntryResponseSchema,
  CreateTimeEntryRequestSchema,
  UpdateTimeEntryRequestSchema,
} from '../src/types.ts';

describe('TimeEntry Schemas', () => {
  describe('TimeEntrySchema', () => {
    test('parses valid time entry', () => {
      const data = {
        id: 12345,
        minutes: 120,
        hours: 2,
        description: 'Worked on feature',
        date: '2024-01-15',
        isBillable: true,
        hasStartTime: false,
        userId: 100,
        taskId: 500,
        projectId: 200,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      };

      const result = TimeEntrySchema.parse(data);

      expect(result.id).toBe(12345);
      expect(result.minutes).toBe(120);
      expect(result.hours).toBe(2);
      expect(result.description).toBe('Worked on feature');
      expect(result.date).toBe('2024-01-15');
      expect(result.isBillable).toBe(true);
    });

    test('handles minimal time entry', () => {
      const data = {
        id: 1,
        minutes: 60,
        date: '2024-01-01',
      };

      const result = TimeEntrySchema.parse(data);

      expect(result.id).toBe(1);
      expect(result.minutes).toBe(60);
      expect(result.date).toBe('2024-01-01');
      expect(result.description).toBe('');
      expect(result.isBillable).toBe(true);
    });

    test('handles null taskId', () => {
      const data = {
        id: 1,
        minutes: 30,
        date: '2024-01-01',
        taskId: null,
      };

      const result = TimeEntrySchema.parse(data);
      expect(result.taskId).toBeNull();
    });

    test('handles tagIds array', () => {
      const data = {
        id: 1,
        minutes: 45,
        date: '2024-01-01',
        tagIds: [1, 2, 3],
      };

      const result = TimeEntrySchema.parse(data);
      expect(result.tagIds).toEqual([1, 2, 3]);
    });
  });

  describe('TimeEntryListResponseSchema', () => {
    test('parses list response with timelogs', () => {
      const data = {
        timelogs: [
          { id: 1, minutes: 60, date: '2024-01-01' },
          { id: 2, minutes: 120, date: '2024-01-02' },
        ],
        meta: {
          page: { pageSize: 50, count: 2 },
        },
      };

      const result = TimeEntryListResponseSchema.parse(data);

      expect(result.timelogs).toHaveLength(2);
      expect(result.timelogs[0]?.id).toBe(1);
      expect(result.meta?.page?.count).toBe(2);
    });

    test('parses empty list response', () => {
      const data = {
        timelogs: [],
      };

      const result = TimeEntryListResponseSchema.parse(data);
      expect(result.timelogs).toEqual([]);
    });

    test('handles included users and tasks', () => {
      const data = {
        timelogs: [{ id: 1, minutes: 60, date: '2024-01-01' }],
        included: {
          users: {
            '100': { id: 100, firstName: 'John', lastName: 'Doe' },
          },
          tasks: {
            '500': { id: 500, name: 'Task Name', description: '' },
          },
        },
      };

      const result = TimeEntryListResponseSchema.parse(data);
      expect(result.included?.users?.['100']?.firstName).toBe('John');
      expect(result.included?.tasks?.['500']?.name).toBe('Task Name');
    });
  });

  describe('TimeEntryResponseSchema', () => {
    test('parses single timelog response', () => {
      const data = {
        timelog: {
          id: 12345,
          minutes: 90,
          date: '2024-01-15',
          description: 'Development work',
          isBillable: false,
        },
      };

      const result = TimeEntryResponseSchema.parse(data);

      expect(result.timelog.id).toBe(12345);
      expect(result.timelog.minutes).toBe(90);
      expect(result.timelog.isBillable).toBe(false);
    });
  });

  describe('CreateTimeEntryRequestSchema', () => {
    test('validates minimal create request', () => {
      const data = {
        timelog: {
          minutes: 60,
          date: '2024-01-15',
        },
      };

      const result = CreateTimeEntryRequestSchema.parse(data);

      expect(result.timelog.minutes).toBe(60);
      expect(result.timelog.date).toBe('2024-01-15');
    });

    test('validates full create request', () => {
      const data = {
        timelog: {
          taskId: 500,
          minutes: 120,
          date: '2024-01-15',
          description: 'Worked on feature X',
          isBillable: true,
          time: '09:30',
          tagIds: [1, 2],
        },
      };

      const result = CreateTimeEntryRequestSchema.parse(data);

      expect(result.timelog.taskId).toBe(500);
      expect(result.timelog.minutes).toBe(120);
      expect(result.timelog.description).toBe('Worked on feature X');
      expect(result.timelog.isBillable).toBe(true);
      expect(result.timelog.time).toBe('09:30');
      expect(result.timelog.tagIds).toEqual([1, 2]);
    });
  });

  describe('UpdateTimeEntryRequestSchema', () => {
    test('validates partial update request', () => {
      const data = {
        timelog: {
          minutes: 90,
        },
      };

      const result = UpdateTimeEntryRequestSchema.parse(data);
      expect(result.timelog.minutes).toBe(90);
    });

    test('validates full update request', () => {
      const data = {
        timelog: {
          minutes: 150,
          date: '2024-01-16',
          description: 'Updated description',
          isBillable: false,
          time: '14:00',
          tagIds: [3, 4],
        },
      };

      const result = UpdateTimeEntryRequestSchema.parse(data);

      expect(result.timelog.minutes).toBe(150);
      expect(result.timelog.isBillable).toBe(false);
      expect(result.timelog.tagIds).toEqual([3, 4]);
    });

    test('validates empty update request', () => {
      const data = {
        timelog: {},
      };

      const result = UpdateTimeEntryRequestSchema.parse(data);
      expect(result.timelog).toEqual({});
    });
  });
});

describe('TimeEntriesResource helpers', () => {
  test('hours to minutes conversion', () => {
    const hours = 2.5;
    const minutes = Math.round(hours * 60);
    expect(minutes).toBe(150);
  });

  test('fractional hours conversion', () => {
    const hours = 0.25;
    const minutes = Math.round(hours * 60);
    expect(minutes).toBe(15);
  });

  test('total hours calculation', () => {
    const timelogs = [
      { minutes: 60 },
      { minutes: 90 },
      { minutes: 30 },
    ];

    const totalHours = timelogs.reduce((sum, entry) => sum + entry.minutes / 60, 0);
    expect(totalHours).toBe(3);
  });
});
