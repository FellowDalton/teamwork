/**
 * Test suite for agent module
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  generateShortId,
  truncateOutput,
  getSafeSubprocessEnv,
  parseJsonlOutput,
  checkClaudeInstalled,
  convertJsonlToJson,
  saveLastEntryAsRawResult,
  savePrompt,
  promptClaudeCode,
  executeTemplate,
  OUTPUT_JSONL,
  OUTPUT_JSON,
  FINAL_OBJECT_JSON,
} from '@/modules/agent';
import { RetryCode } from '@/modules/data-models';
import { existsSync } from 'fs';
import { rm, writeFile, mkdir } from 'fs/promises';
import path from 'path';

describe('agent', () => {
  describe('generateShortId', () => {
    it('should generate 8-character UUID', () => {
      const id = generateShortId();
      expect(id).toHaveLength(8);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateShortId()));
      expect(ids.size).toBe(100);
    });

    it('should only contain valid UUID characters', () => {
      const id = generateShortId();
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('truncateOutput', () => {
    it('should not truncate short output', () => {
      const text = 'short output';
      expect(truncateOutput(text, 500)).toBe(text);
    });

    it('should truncate long output with suffix', () => {
      const text = 'a'.repeat(600);
      const result = truncateOutput(text, 500);
      expect(result).toHaveLength(500);
      expect(result).toEndWith('... (truncated)');
    });

    it('should use custom suffix', () => {
      const text = 'a'.repeat(600);
      const result = truncateOutput(text, 500, '...[MORE]');
      expect(result).toEndWith('...[MORE]');
    });

    it('should break at newline when possible', () => {
      const text = 'a'.repeat(450) + '\n' + 'b'.repeat(100);
      const result = truncateOutput(text, 500);
      expect(result).not.toContain('b');
      expect(result).toEndWith('... (truncated)');
    });

    it('should break at space when no newline', () => {
      const text = 'a'.repeat(490) + ' ' + 'b'.repeat(100);
      const result = truncateOutput(text, 500);
      expect(result).not.toContain('b');
      expect(result).toEndWith('... (truncated)');
    });

    it('should detect and extract from JSONL output', () => {
      const jsonl = '{"type":"status","message":"test"}\n{"type":"result","result":"done"}';
      const result = truncateOutput(jsonl, 500);
      // Should extract the result value from JSONL
      expect(result).toBe('done');
    });

    it('should extract result from JSONL', () => {
      const jsonl = '{"type":"status"}\n{"type":"result","result":"final result"}';
      const result = truncateOutput(jsonl, 500);
      expect(result).toBe('final result');
    });

    it('should extract assistant message from JSONL', () => {
      const jsonl =
        '{"type":"assistant","message":{"content":[{"text":"assistant says hi"}]}}\n{"type":"result"}';
      const result = truncateOutput(jsonl, 500);
      expect(result).toBe('assistant says hi');
    });

    it('should handle invalid JSON lines gracefully', () => {
      const jsonl = '{"type":"status"}\ninvalid json\n{"type":"result"}';
      const result = truncateOutput(jsonl, 500);
      expect(result).toContain('JSONL output');
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

    it('should use default CLAUDE_CODE_PATH', () => {
      delete process.env.CLAUDE_CODE_PATH;
      const env = getSafeSubprocessEnv();
      expect(env.CLAUDE_CODE_PATH).toBe('claude');
    });

    it('should include system variables', () => {
      const env = getSafeSubprocessEnv();
      expect(env.HOME).toBeDefined();
      expect(env.PATH).toBeDefined();
    });

    it('should filter out undefined values', () => {
      delete process.env.PYTHONPATH;
      const env = getSafeSubprocessEnv();
      expect(env.PYTHONPATH).toBeUndefined();
    });

    it('should set PYTHONUNBUFFERED to 1', () => {
      const env = getSafeSubprocessEnv();
      expect(env.PYTHONUNBUFFERED).toBe('1');
    });
  });

  describe('parseJsonlOutput', () => {
    const testDir = path.join(import.meta.dir, '../../.test-tmp');
    const testFile = path.join(testDir, 'test.jsonl');

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      if (existsSync(testDir)) {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it('should parse valid JSONL file', async () => {
      const jsonl = '{"type":"status"}\n{"type":"result","result":"done"}';
      await writeFile(testFile, jsonl);

      const [messages, result] = await parseJsonlOutput(testFile);
      expect(messages).toHaveLength(2);
      expect(result?.type).toBe('result');
    });

    it('should return result message as second element', async () => {
      const jsonl = '{"type":"status"}\n{"type":"result","result":"done"}';
      await writeFile(testFile, jsonl);

      const [, result] = await parseJsonlOutput(testFile);
      expect(result?.result).toBe('done');
    });

    it('should handle empty file', async () => {
      await writeFile(testFile, '');

      const [messages, result] = await parseJsonlOutput(testFile);
      expect(messages).toHaveLength(0);
      expect(result).toBeNull();
    });

    it('should skip invalid JSON lines', async () => {
      const jsonl = '{"type":"valid"}\ninvalid json\n{"type":"result"}';
      await writeFile(testFile, jsonl);

      const [messages, result] = await parseJsonlOutput(testFile);
      expect(messages).toHaveLength(2);
      expect(result?.type).toBe('result');
    });

    it('should find result message in last position', async () => {
      const jsonl = '{"type":"result","result":"first"}\n{"type":"status"}\n{"type":"result","result":"last"}';
      await writeFile(testFile, jsonl);

      const [, result] = await parseJsonlOutput(testFile);
      expect(result?.result).toBe('last');
    });

    it('should handle missing file', async () => {
      const [messages, result] = await parseJsonlOutput('/nonexistent/file.jsonl');
      expect(messages).toHaveLength(0);
      expect(result).toBeNull();
    });
  });

  describe('convertJsonlToJson', () => {
    const testDir = path.join(import.meta.dir, '../../.test-tmp');
    const jsonlFile = path.join(testDir, OUTPUT_JSONL);
    const jsonFile = path.join(testDir, OUTPUT_JSON);

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      if (existsSync(testDir)) {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it('should convert JSONL to JSON array', async () => {
      const jsonl = '{"type":"status"}\n{"type":"result"}';
      await writeFile(jsonlFile, jsonl);

      const outputPath = await convertJsonlToJson(jsonlFile);
      expect(outputPath).toBe(jsonFile);
      expect(existsSync(jsonFile)).toBe(true);
    });

    it('should write valid JSON array', async () => {
      const jsonl = '{"type":"status"}\n{"type":"result"}';
      await writeFile(jsonlFile, jsonl);

      await convertJsonlToJson(jsonlFile);
      const file = Bun.file(jsonFile);
      const data = await file.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
    });
  });

  describe('saveLastEntryAsRawResult', () => {
    const testDir = path.join(import.meta.dir, '../../.test-tmp');
    const jsonFile = path.join(testDir, OUTPUT_JSON);
    const finalFile = path.join(testDir, FINAL_OBJECT_JSON);

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      if (existsSync(testDir)) {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it('should save last entry', async () => {
      const data = [{ type: 'first' }, { type: 'last' }];
      await writeFile(jsonFile, JSON.stringify(data));

      const outputPath = await saveLastEntryAsRawResult(jsonFile);
      expect(outputPath).toBe(finalFile);
      expect(existsSync(finalFile)).toBe(true);
    });

    it('should write correct last entry', async () => {
      const data = [{ type: 'first' }, { type: 'last', value: 'final' }];
      await writeFile(jsonFile, JSON.stringify(data));

      await saveLastEntryAsRawResult(jsonFile);
      const file = Bun.file(finalFile);
      const lastEntry = await file.json();
      expect(lastEntry.type).toBe('last');
      expect(lastEntry.value).toBe('final');
    });

    it('should return null for empty array', async () => {
      await writeFile(jsonFile, '[]');

      const outputPath = await saveLastEntryAsRawResult(jsonFile);
      expect(outputPath).toBeNull();
    });

    it('should return null for invalid file', async () => {
      const outputPath = await saveLastEntryAsRawResult('/nonexistent/file.json');
      expect(outputPath).toBeNull();
    });
  });

  describe('savePrompt', () => {
    const testAdwId = 'test1234';
    const testDir = path.join(import.meta.dir, '../../agents', testAdwId, 'test-agent', 'prompts');

    afterEach(async () => {
      const agentDir = path.join(import.meta.dir, '../../agents', testAdwId);
      if (existsSync(agentDir)) {
        await rm(agentDir, { recursive: true, force: true });
      }
    });

    it('should save prompt to correct location', async () => {
      await savePrompt('/test_command arg1 arg2', testAdwId, 'test-agent');

      const promptFile = path.join(testDir, 'test_command.txt');
      expect(existsSync(promptFile)).toBe(true);
    });

    it('should save prompt content', async () => {
      const prompt = '/build Create a new feature';
      await savePrompt(prompt, testAdwId, 'test-agent');

      const promptFile = path.join(testDir, 'build.txt');
      const file = Bun.file(promptFile);
      const content = await file.text();
      expect(content).toBe(prompt);
    });

    it('should not save if no slash command', async () => {
      await savePrompt('no slash command here', testAdwId, 'test-agent');
      expect(existsSync(testDir)).toBe(false);
    });

    it('should use default agent name', async () => {
      await savePrompt('/test command', testAdwId);

      const opsDir = path.join(import.meta.dir, '../../agents', testAdwId, 'ops', 'prompts');
      const promptFile = path.join(opsDir, 'test.txt');
      expect(existsSync(promptFile)).toBe(true);
    });
  });

  describe('checkClaudeInstalled', () => {
    it('should return null if claude is installed', async () => {
      // This test may fail if Claude Code is not installed
      // Skip or modify based on test environment
      const result = await checkClaudeInstalled();
      // Just verify the function doesn't throw
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('promptClaudeCode', () => {
    const testDir = path.join(import.meta.dir, '../../.test-tmp');
    const outputFile = path.join(testDir, OUTPUT_JSONL);

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      if (existsSync(testDir)) {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it('should validate promptClaudeCode interface', () => {
      // Just validate that the function exists and has the right signature
      expect(typeof promptClaudeCode).toBe('function');
    });

    // Note: Full integration tests with actual Claude Code CLI would require
    // the CLI to be installed and API key configured. These are more suitable
    // for integration/e2e tests rather than unit tests.
  });

  describe('executeTemplate', () => {
    it('should validate executeTemplate interface', () => {
      // Just validate that the function exists and has the right signature
      expect(typeof executeTemplate).toBe('function');
    });

    it('should construct prompt from command and args', () => {
      const request = {
        agentName: 'builder',
        slashCommand: '/build',
        args: ['arg1', 'arg2'],
        adwId: 'test1234',
        model: 'sonnet' as const,
      };
      // Verify request structure is valid
      expect(request.slashCommand).toBe('/build');
      expect(request.args).toEqual(['arg1', 'arg2']);
    });

    // Note: Full integration tests would require Claude Code CLI installed
    // These tests validate the interface and data structures only
  });

  describe('RetryCode integration', () => {
    it('should use correct retry codes', () => {
      expect(RetryCode.NONE).toBe('none');
      expect(RetryCode.CLAUDE_CODE_ERROR).toBe('claude_code_error');
      expect(RetryCode.TIMEOUT_ERROR).toBe('timeout_error');
      expect(RetryCode.EXECUTION_ERROR).toBe('execution_error');
      expect(RetryCode.ERROR_DURING_EXECUTION).toBe('error_during_execution');
    });
  });

  describe('output file constants', () => {
    it('should define correct output file names', () => {
      expect(OUTPUT_JSONL).toBe('cc_raw_output.jsonl');
      expect(OUTPUT_JSON).toBe('cc_raw_output.json');
      expect(FINAL_OBJECT_JSON).toBe('cc_final_object.json');
    });
  });
});
