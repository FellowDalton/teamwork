/**
 * Test suite for utils module
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { z } from 'zod';
import {
  makeAdwId,
  parseJson,
  checkEnvVars,
  formatAgentStatus,
  formatWorktreeStatus,
  formatDuration,
  truncate,
  getSafeSubprocessEnv,
  setupLogger,
  getLogger,
  Logger,
  fileExists,
  ensureDir,
  sleep,
} from '@/modules/utils';
import { existsSync } from 'fs';
import { rm, readFile } from 'fs/promises';
import path from 'path';

describe('utils', () => {
  describe('makeAdwId', () => {
    it('should generate 8-character UUID', () => {
      const id = makeAdwId();
      expect(id).toHaveLength(8);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => makeAdwId()));
      expect(ids.size).toBe(100);
    });

    it('should only contain valid UUID characters', () => {
      const id = makeAdwId();
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('parseJson', () => {
    it('should parse plain JSON object', () => {
      const result = parseJson('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse plain JSON array', () => {
      const result = parseJson('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should extract JSON from ```json markdown blocks', () => {
      const markdown = '```json\n{"key": "value"}\n```';
      const result = parseJson(markdown);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from ``` markdown blocks', () => {
      const markdown = '```\n{"key": "value"}\n```';
      const result = parseJson(markdown);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle JSON with extra whitespace', () => {
      const text = '  \n  {"key": "value"}  \n  ';
      const result = parseJson(text);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from surrounding text', () => {
      const text = 'Here is some JSON: {"key": "value"} and more text';
      const result = parseJson(text);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON array from surrounding text', () => {
      const text = 'Here is an array: [1, 2, 3] end';
      const result = parseJson(text);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should extract JSON array when embedded in text', () => {
      const text = 'Here is data: [1, 2, 3]';
      const result = parseJson(text);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should validate with Zod schema', () => {
      const schema = z.object({ key: z.string() });
      const result = parseJson('{"key": "value"}', schema);
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw on Zod validation failure', () => {
      const schema = z.object({ key: z.number() });
      expect(() => parseJson('{"key": "value"}', schema)).toThrow('Zod validation failed');
    });

    it('should throw on malformed JSON', () => {
      expect(() => parseJson('not valid json')).toThrow('Failed to parse JSON');
    });

    it('should handle complex nested JSON', () => {
      const json = {
        nested: {
          array: [1, 2, { deep: 'value' }],
          bool: true,
        },
      };
      const result = parseJson(JSON.stringify(json));
      expect(result).toEqual(json);
    });
  });

  describe('checkEnvVars', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      // Restore original environment
      process.env = { ...originalEnv };
    });

    it('should return empty array when all vars present', () => {
      process.env.CLAUDE_CODE_PATH = '/usr/bin/claude';

      const { missing } = checkEnvVars(['CLAUDE_CODE_PATH']);
      expect(missing).toEqual([]);
    });

    it('should return missing variable names', () => {
      delete process.env.CLAUDE_CODE_PATH;
      process.env.SOME_OTHER_VAR = 'test';

      const { missing } = checkEnvVars(['SOME_OTHER_VAR', 'CLAUDE_CODE_PATH']);
      expect(missing).toEqual(['CLAUDE_CODE_PATH']);
    });

    it('should check default vars when none provided (only CLAUDE_CODE_PATH)', () => {
      delete process.env.CLAUDE_CODE_PATH;

      const { missing } = checkEnvVars();
      expect(missing).toContain('CLAUDE_CODE_PATH');
      expect(missing.length).toBe(1);
    });

    it('should work with logger', () => {
      const mockLogger = {
        error: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        debug: mock(() => {}),
        getLogFile: mock(() => '/tmp/test.log'),
      };

      delete process.env.TEST_VAR;
      checkEnvVars(['TEST_VAR'], mockLogger);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('formatAgentStatus', () => {
    it('should format basic status without phase', () => {
      const result = formatAgentStatus('Building solution', 'abc12345', 'feature-branch');
      expect(result).toBe('Building solution (abc123@feature-branch)');
    });

    it('should format status with phase', () => {
      const result = formatAgentStatus('Building solution', 'abc12345', 'feature-branch', 'build');
      expect(result).toBe('Building solution (abc123@feature-branch • build)');
    });

    it('should handle short ADW IDs', () => {
      const result = formatAgentStatus('Testing', 'abc', 'main');
      expect(result).toBe('Testing (abc@main)');
    });

    it('should truncate long ADW IDs to 6 chars', () => {
      const result = formatAgentStatus('Testing', 'abcdefghij', 'main');
      expect(result).toBe('Testing (abcdef@main)');
    });
  });

  describe('formatWorktreeStatus', () => {
    it('should format without ADW ID', () => {
      const result = formatWorktreeStatus('Creating', 'feat-auth');
      expect(result).toBe("Creating worktree 'feat-auth'");
    });

    it('should format with ADW ID', () => {
      const result = formatWorktreeStatus('Creating', 'feat-auth', 'abc12345');
      expect(result).toBe("Creating worktree 'feat-auth' (abc123)");
    });

    it('should handle short ADW IDs', () => {
      const result = formatWorktreeStatus('Creating', 'feat-auth', 'abc');
      expect(result).toBe("Creating worktree 'feat-auth' (abc)");
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(2500)).toBe('2.5s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(5400000)).toBe('1h 30m');
    });

    it('should handle exact seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0ms');
    });

    it('should format large durations', () => {
      expect(formatDuration(7260000)).toBe('2h 1m'); // 2 hours 1 minute
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      const text = 'short';
      expect(truncate(text, 100)).toBe(text);
    });

    it('should truncate long strings with ellipsis', () => {
      const text = 'a'.repeat(150);
      const result = truncate(text, 100);
      expect(result).toHaveLength(100);
      expect(result).toEndWith('...');
    });

    it('should use default max length of 100', () => {
      const text = 'a'.repeat(150);
      const result = truncate(text);
      expect(result).toHaveLength(100);
    });

    it('should handle empty strings', () => {
      expect(truncate('')).toBe('');
    });

    it('should truncate exactly at boundary', () => {
      const text = 'a'.repeat(100);
      expect(truncate(text, 100)).toBe(text);
      expect(truncate(text + 'b', 100)).toHaveLength(100);
    });
  });

  describe('getSafeSubprocessEnv', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should NOT include ANTHROPIC_API_KEY (to use Claude Code subscription)', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const env = getSafeSubprocessEnv();
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('should include CLAUDE_CODE_PATH with default', () => {
      delete process.env.CLAUDE_CODE_PATH;
      const env = getSafeSubprocessEnv();
      expect(env.CLAUDE_CODE_PATH).toBe('claude');
    });

    it('should include system variables', () => {
      const env = getSafeSubprocessEnv();
      expect(env.HOME).toBeDefined();
      expect(env.PATH).toBeDefined();
    });

    it('should include PWD as current directory', () => {
      const env = getSafeSubprocessEnv();
      expect(env.PWD).toBe(process.cwd());
    });

    it('should not include undefined values', () => {
      delete process.env.E2B_API_KEY;
      const env = getSafeSubprocessEnv();
      expect(env.E2B_API_KEY).toBeUndefined();
    });

    it('should include optional GITHUB_PAT as both GITHUB_PAT and GH_TOKEN', () => {
      process.env.GITHUB_PAT = 'test-pat';
      const env = getSafeSubprocessEnv();
      expect(env.GITHUB_PAT).toBe('test-pat');
      expect(env.GH_TOKEN).toBe('test-pat');
    });

    it('should not include GH_TOKEN if GITHUB_PAT is missing', () => {
      delete process.env.GITHUB_PAT;
      const env = getSafeSubprocessEnv();
      expect(env.GH_TOKEN).toBeUndefined();
    });
  });

  describe('logger', () => {
    const testAdwId = makeAdwId();
    const projectRoot = path.resolve(import.meta.dir, '../../');
    const logDir = path.join(projectRoot, 'agents', testAdwId, 'test_trigger');
    let logger: Logger;

    afterEach(async () => {
      // Clean up test log directory
      if (existsSync(logDir)) {
        await rm(logDir, { recursive: true, force: true });
      }
    });

    it('should create logger with setupLogger', async () => {
      logger = await setupLogger(testAdwId, 'test_trigger');
      expect(logger).toBeDefined();
      expect(logger.getLogFile()).toContain(testAdwId);
    });

    it('should create log directory', async () => {
      logger = await setupLogger(testAdwId, 'test_trigger');
      expect(existsSync(logDir)).toBe(true);
    });

    it('should write to log file', async () => {
      logger = await setupLogger(testAdwId, 'test_trigger');
      logger.info('Test message');

      const logFile = logger.getLogFile();
      const logContent = await readFile(logFile, 'utf-8');
      expect(logContent).toContain('Test message');
    });

    it('should include timestamp and level in log file', async () => {
      logger = await setupLogger(testAdwId, 'test_trigger');
      logger.info('Test message');

      const logFile = logger.getLogFile();
      const logContent = await readFile(logFile, 'utf-8');
      expect(logContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} - INFO - Test message/);
    });

    it('should retrieve logger with getLogger', async () => {
      logger = await setupLogger(testAdwId, 'test_trigger');
      const retrieved = getLogger(testAdwId);
      expect(retrieved).toBe(logger);
    });

    it('should throw when retrieving non-existent logger', () => {
      expect(() => getLogger('nonexistent')).toThrow('Logger not found');
    });

    it('should support different log levels', async () => {
      logger = await setupLogger(testAdwId, 'test_trigger');
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      const logFile = logger.getLogFile();
      const logContent = await readFile(logFile, 'utf-8');
      expect(logContent).toContain('DEBUG - Debug message');
      expect(logContent).toContain('INFO - Info message');
      expect(logContent).toContain('WARN - Warn message');
      expect(logContent).toContain('ERROR - Error message');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', () => {
      const testFile = import.meta.path;
      expect(fileExists(testFile)).toBe(true);
    });

    it('should return false for non-existent file', () => {
      expect(fileExists('/nonexistent/path/file.txt')).toBe(false);
    });
  });

  describe('ensureDir', () => {
    const testDir = path.join(import.meta.dir, '../../.test-tmp');

    afterEach(async () => {
      if (existsSync(testDir)) {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it('should create directory', async () => {
      await ensureDir(testDir);
      expect(existsSync(testDir)).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'nested', 'deep');
      await ensureDir(nestedDir);
      expect(existsSync(nestedDir)).toBe(true);
    });

    it('should not error if directory exists', async () => {
      await ensureDir(testDir);
      await expect(ensureDir(testDir)).resolves.toBeUndefined();
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow small margin
      expect(elapsed).toBeLessThan(200);
    });

    it('should resolve after delay', async () => {
      let resolved = false;
      const promise = sleep(50).then(() => {
        resolved = true;
      });
      expect(resolved).toBe(false);
      await promise;
      expect(resolved).toBe(true);
    });
  });
});
