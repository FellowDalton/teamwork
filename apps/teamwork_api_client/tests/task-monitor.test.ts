/**
 * Tests for the task monitor facade and utilities.
 */

import { describe, test, expect } from 'bun:test';
import {
  extractInlineTags,
  parseNativeTags,
  detectExecutionTrigger,
  cleanTaskDescription,
  getTaskPromptForAgent,
} from '../src/task-monitor.ts';

describe('extractInlineTags', () => {
  test('extracts single inline tag', () => {
    const description = 'Build a {{prototype: vite_vue}} application';
    const tags = extractInlineTags(description);

    expect(tags).toEqual({ prototype: 'vite_vue' });
  });

  test('extracts multiple inline tags', () => {
    const description = '{{model: opus}} Create app {{prototype: vite_vue}} with {{worktree: my-feature}}';
    const tags = extractInlineTags(description);

    expect(tags).toEqual({
      model: 'opus',
      prototype: 'vite_vue',
      worktree: 'my-feature',
    });
  });

  test('handles tag with spaces in value', () => {
    const description = '{{app: my app name}}';
    const tags = extractInlineTags(description);

    expect(tags).toEqual({ app: 'my app name' });
  });

  test('normalizes key to lowercase', () => {
    const description = '{{MODEL: sonnet}} {{Prototype: bun_scripts}}';
    const tags = extractInlineTags(description);

    expect(tags).toEqual({
      model: 'sonnet',
      prototype: 'bun_scripts',
    });
  });

  test('returns empty object for no tags', () => {
    const description = 'A simple task without any tags';
    const tags = extractInlineTags(description);

    expect(tags).toEqual({});
  });

  test('handles empty description', () => {
    const tags = extractInlineTags('');
    expect(tags).toEqual({});
  });

  test('handles malformed tags gracefully', () => {
    const description = '{{incomplete tag}} and {{key:}} and normal {{valid: tag}}';
    const tags = extractInlineTags(description);

    // Only valid tags should be extracted
    expect(tags).toEqual({ valid: 'tag' });
  });
});

describe('parseNativeTags', () => {
  test('parses tags with colon format', () => {
    const tags = [
      { id: 1, name: 'prototype:vite_vue' },
      { id: 2, name: 'model:sonnet' },
    ];
    const parsed = parseNativeTags(tags);

    expect(parsed).toEqual({
      prototype: 'vite_vue',
      model: 'sonnet',
    });
  });

  test('ignores tags without colon', () => {
    const tags = [
      { id: 1, name: 'urgent' },
      { id: 2, name: 'prototype:uv_script' },
      { id: 3, name: 'bug' },
    ];
    const parsed = parseNativeTags(tags);

    expect(parsed).toEqual({ prototype: 'uv_script' });
  });

  test('handles empty array', () => {
    const parsed = parseNativeTags([]);
    expect(parsed).toEqual({});
  });

  test('handles tags with spaces', () => {
    const tags = [{ id: 1, name: ' worktree : my-feature ' }];
    const parsed = parseNativeTags(tags);

    expect(parsed).toEqual({ worktree: 'my-feature' });
  });

  test('normalizes key to lowercase', () => {
    const tags = [{ id: 1, name: 'MODEL:opus' }];
    const parsed = parseNativeTags(tags);

    expect(parsed).toEqual({ model: 'opus' });
  });

  test('handles multiple colons (takes first as separator)', () => {
    const tags = [{ id: 1, name: 'config:key:value' }];
    const parsed = parseNativeTags(tags);

    expect(parsed).toEqual({ config: 'key:value' });
  });
});

describe('detectExecutionTrigger', () => {
  test('detects execute trigger at end', () => {
    const description = 'Build a new feature execute';
    const result = detectExecutionTrigger(description);

    expect(result).toEqual({ trigger: 'execute' });
  });

  test('detects execute trigger with trailing whitespace', () => {
    const description = 'Build a new feature execute  ';
    const result = detectExecutionTrigger(description);

    expect(result).toEqual({ trigger: 'execute' });
  });

  test('detects continue trigger with prompt', () => {
    const description = 'Original task description\ncontinue - Add error handling';
    const result = detectExecutionTrigger(description);

    expect(result).toEqual({
      trigger: 'continue',
      continuePrompt: 'Add error handling',
    });
  });

  test('detects continue trigger case insensitive', () => {
    const description = 'Task\nCONTINUE - Fix the tests';
    const result = detectExecutionTrigger(description);

    expect(result).toEqual({
      trigger: 'continue',
      continuePrompt: 'Fix the tests',
    });
  });

  test('returns null for no trigger', () => {
    const description = 'A task without execution trigger';
    const result = detectExecutionTrigger(description);

    expect(result).toEqual({ trigger: null });
  });

  test('handles empty description', () => {
    const result = detectExecutionTrigger('');
    expect(result).toEqual({ trigger: null });
  });

  test('does not match execute in middle of text', () => {
    const description = 'Please execute this command and then do something else';
    const result = detectExecutionTrigger(description);

    expect(result).toEqual({ trigger: null });
  });

  test('handles continue with multiline prompt', () => {
    const description = 'Original task\ncontinue - Add these features:\n- Feature 1\n- Feature 2';
    const result = detectExecutionTrigger(description);

    expect(result).toEqual({
      trigger: 'continue',
      continuePrompt: 'Add these features:\n- Feature 1\n- Feature 2',
    });
  });
});

describe('cleanTaskDescription', () => {
  test('removes inline tags', () => {
    const description = '{{model: opus}} Build a feature {{prototype: vite_vue}}';
    const cleaned = cleanTaskDescription(description);

    expect(cleaned).toBe('Build a feature');
  });

  test('removes execute trigger', () => {
    const description = 'Build a new feature execute';
    const cleaned = cleanTaskDescription(description);

    expect(cleaned).toBe('Build a new feature');
  });

  test('removes continue trigger', () => {
    const description = 'Original task\ncontinue - Add more stuff';
    const cleaned = cleanTaskDescription(description);

    expect(cleaned).toBe('Original task');
  });

  test('removes all tags and triggers', () => {
    const description = '{{model: sonnet}} Build a {{prototype: vite_vue}} app execute';
    const cleaned = cleanTaskDescription(description);

    expect(cleaned).toBe('Build a  app');
  });

  test('handles empty description', () => {
    const cleaned = cleanTaskDescription('');
    expect(cleaned).toBe('');
  });

  test('preserves normal text', () => {
    const description = 'A simple task without any special markers';
    const cleaned = cleanTaskDescription(description);

    expect(cleaned).toBe('A simple task without any special markers');
  });
});

describe('getTaskPromptForAgent', () => {
  test('returns continue prompt when trigger is continue', () => {
    const description = 'Original task\ncontinue - Fix the bug';
    const prompt = getTaskPromptForAgent(description, 'continue', 'Fix the bug');

    expect(prompt).toBe('Fix the bug');
  });

  test('returns cleaned description for execute trigger', () => {
    const description = '{{model: opus}} Build feature execute';
    const prompt = getTaskPromptForAgent(description, 'execute');

    expect(prompt).toBe('Build feature');
  });

  test('returns cleaned description for null trigger', () => {
    const description = '{{prototype: vite_vue}} Build a web app';
    const prompt = getTaskPromptForAgent(description, null);

    expect(prompt).toBe('Build a web app');
  });

  test('falls back to cleaned description if continue prompt missing', () => {
    const description = 'Original task\ncontinue - ';
    const prompt = getTaskPromptForAgent(description, 'continue', undefined);

    expect(prompt).toBe('Original task');
  });
});
