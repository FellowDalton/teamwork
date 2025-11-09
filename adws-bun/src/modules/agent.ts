/**
 * Claude Code agent module for executing prompts programmatically.
 * TypeScript/Bun port of adws/adw_modules/agent.py
 */

import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

// Import data models (assuming parallel migration)
import {
  AgentPromptRequest,
  AgentPromptResponse,
  AgentTemplateRequest,
  RetryCode,
} from './data-models';

// Output file name constants (matching Python implementation)
export const OUTPUT_JSONL = 'cc_raw_output.jsonl';
export const OUTPUT_JSON = 'cc_raw_output.json';
export const FINAL_OBJECT_JSON = 'cc_final_object.json';
export const SUMMARY_JSON = 'custom_summary_output.json';

// Get Claude Code CLI path from environment
const CLAUDE_PATH = process.env.CLAUDE_CODE_PATH || 'claude';

/**
 * Generate a short 8-character UUID for tracking.
 */
export function generateShortId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Get filtered environment variables safe for subprocess execution.
 * Returns only the environment variables needed based on .env configuration.
 */
export function getSafeSubprocessEnv(): Record<string, string> {
  const safeEnvVars: Record<string, string | undefined> = {
    // Anthropic Configuration (required)
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

    // Claude Code Configuration
    CLAUDE_CODE_PATH: process.env.CLAUDE_CODE_PATH || 'claude',
    CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR:
      process.env.CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR || 'true',

    // Essential system environment variables
    HOME: process.env.HOME,
    USER: process.env.USER,
    PATH: process.env.PATH,
    SHELL: process.env.SHELL,
    TERM: process.env.TERM,
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,

    // Python-specific variables that subprocesses might need
    PYTHONPATH: process.env.PYTHONPATH,
    PYTHONUNBUFFERED: '1', // Useful for subprocess output

    // Working directory tracking
    PWD: process.cwd(),
  };

  // Filter out undefined values
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(safeEnvVars)) {
    if (value !== undefined) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Check if Claude Code CLI is installed. Return error message if not.
 */
export async function checkClaudeInstalled(): Promise<string | null> {
  try {
    const proc = Bun.spawn({
      cmd: [CLAUDE_PATH, '--version'],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return `Error: Claude Code CLI is not installed. Expected at: ${CLAUDE_PATH}`;
    }
    return null;
  } catch (error) {
    return `Error: Claude Code CLI is not installed. Expected at: ${CLAUDE_PATH}`;
  }
}

/**
 * Truncate output to a reasonable length for display.
 * Special handling for JSONL data - if the output appears to be JSONL,
 * try to extract just the meaningful part.
 */
export function truncateOutput(
  output: string,
  maxLength: number = 500,
  suffix: string = '... (truncated)'
): string {
  // Check if this looks like JSONL data
  if (output.startsWith('{"type":') && output.includes('\n{"type":')) {
    // This is likely JSONL output - try to extract the last meaningful message
    const lines = output.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      try {
        const data = JSON.parse(line);
        // Look for result message
        if (data.type === 'result') {
          const result = data.result || '';
          if (result) {
            return truncateOutput(result, maxLength, suffix);
          }
        }
        // Look for assistant message
        else if (data.type === 'assistant' && data.message) {
          const content = data.message.content || [];
          if (Array.isArray(content) && content.length > 0) {
            const text = content[0].text || '';
            if (text) {
              return truncateOutput(text, maxLength, suffix);
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
    // If we couldn't extract anything meaningful, just show that it's JSONL
    return `[JSONL output with ${lines.length} messages]${suffix}`;
  }

  // Regular truncation logic
  if (output.length <= maxLength) {
    return output;
  }

  // Try to find a good break point (newline or space)
  const truncateAt = maxLength - suffix.length;

  // Look for newline near the truncation point
  const newlineSearchStart = Math.max(0, truncateAt - 50);
  const newlinePos = output.lastIndexOf('\n', truncateAt);
  if (newlinePos >= newlineSearchStart && newlinePos > 0) {
    return output.slice(0, newlinePos) + suffix;
  }

  // Look for space near the truncation point
  const spaceSearchStart = Math.max(0, truncateAt - 20);
  const spacePos = output.lastIndexOf(' ', truncateAt);
  if (spacePos >= spaceSearchStart) {
    return output.slice(0, spacePos) + suffix;
  }

  // Just truncate at the limit
  return output.slice(0, truncateAt) + suffix;
}

/**
 * Parse JSONL output file and return all messages and the result message.
 * Returns tuple of [all_messages, result_message] where result_message is null if not found.
 */
export async function parseJsonlOutput(
  outputFile: string
): Promise<[Array<Record<string, any>>, Record<string, any> | null]> {
  try {
    const file = Bun.file(outputFile);
    const text = await file.text();

    // Read all lines and parse each as JSON
    const messages: Array<Record<string, any>> = [];
    for (const line of text.split('\n')) {
      if (line.trim()) {
        try {
          messages.push(JSON.parse(line));
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    // Find the result message (should be the last one)
    let resultMessage: Record<string, any> | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.type === 'result') {
        resultMessage = msg;
        break;
      }
    }

    return [messages, resultMessage];
  } catch (error) {
    return [[], null];
  }
}

/**
 * Convert JSONL file to JSON array file.
 * Creates a cc_raw_output.json file in the same directory as the JSONL file,
 * containing all messages as a JSON array.
 * Returns path to the created JSON file.
 */
export async function convertJsonlToJson(jsonlFile: string): Promise<string> {
  // Create JSON filename in the same directory
  const outputDir = dirname(jsonlFile);
  const jsonFile = join(outputDir, OUTPUT_JSON);

  // Parse the JSONL file
  const [messages] = await parseJsonlOutput(jsonlFile);

  // Write as JSON array
  await Bun.write(jsonFile, JSON.stringify(messages, null, 2));

  return jsonFile;
}

/**
 * Save the last entry from a JSON array file as cc_final_object.json.
 * Returns path to the created cc_final_object.json file, or null if error.
 */
export async function saveLastEntryAsRawResult(jsonFile: string): Promise<string | null> {
  try {
    // Read the JSON array
    const file = Bun.file(jsonFile);
    const messages = await file.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    // Get the last entry
    const lastEntry = messages[messages.length - 1];

    // Create cc_final_object.json in the same directory
    const outputDir = dirname(jsonFile);
    const finalObjectFile = join(outputDir, FINAL_OBJECT_JSON);

    // Write the last entry
    await Bun.write(finalObjectFile, JSON.stringify(lastEntry, null, 2));

    return finalObjectFile;
  } catch {
    // Silently fail - this is a nice-to-have feature
    return null;
  }
}

/**
 * Save a prompt to the appropriate logging directory.
 */
export async function savePrompt(
  prompt: string,
  adwId: string,
  agentName: string = 'ops'
): Promise<void> {
  // Extract slash command from prompt
  const match = prompt.match(/^(\/\w+)/);
  if (!match || !match[1]) {
    return;
  }

  const slashCommand = match[1];
  // Remove leading slash for filename
  const commandName = slashCommand.slice(1);

  // Create directory structure at project root
  // Get project root (should be where this file is running from)
  const projectRoot = process.cwd();
  const promptDir = join(projectRoot, 'agents', adwId, agentName, 'prompts');

  // Create directory
  await Bun.write(join(promptDir, '.gitkeep'), '');

  // Save prompt to file
  const promptFile = join(promptDir, `${commandName}.txt`);
  await Bun.write(promptFile, prompt);
}

/**
 * Execute Claude Code with the given prompt configuration.
 */
export async function promptClaudeCode(request: AgentPromptRequest): Promise<AgentPromptResponse> {
  // Check if Claude Code CLI is installed
  const errorMsg = await checkClaudeInstalled();
  if (errorMsg) {
    return {
      output: errorMsg,
      success: false,
      sessionId: null,
      retryCode: RetryCode.NONE, // Installation error is not retryable
    };
  }

  // Save prompt before execution
  await savePrompt(request.prompt, request.adwId, request.agentName);

  // Create output directory if needed
  const outputDir = dirname(request.outputFile);
  if (outputDir) {
    await Bun.write(join(outputDir, '.gitkeep'), '');
  }

  // Build command - always use stream-json format and verbose
  const cmd = [CLAUDE_PATH, '-p', request.prompt];
  cmd.push('--model', request.model);
  cmd.push('--output-format', 'stream-json');
  cmd.push('--verbose');

  // Check for MCP config in working directory
  if (request.workingDir) {
    const mcpConfigPath = join(request.workingDir, '.mcp.json');
    const mcpConfigFile = Bun.file(mcpConfigPath);
    if (await mcpConfigFile.exists()) {
      cmd.push('--mcp-config');
      cmd.push(mcpConfigPath);
    }
  }

  // Add dangerous skip permissions flag if enabled
  if (request.dangerouslySkipPermissions) {
    cmd.push('--dangerously-skip-permissions');
  }

  // Set up environment with only required variables
  const env = getSafeSubprocessEnv();

  try {
    // Execute Claude Code and stream output to file
    const spawnOptions: any = {
      cmd,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    };

    // Only set cwd if workingDir is provided
    if (request.workingDir) {
      spawnOptions.cwd = request.workingDir;
    }

    const proc = Bun.spawn(spawnOptions);

    // Stream stdout to file
    const stdout = await new Response(proc.stdout).text();
    await Bun.write(request.outputFile, stdout);

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (exitCode === 0) {
      // Parse the JSONL file
      const [, resultMessage] = await parseJsonlOutput(request.outputFile);

      // Convert JSONL to JSON array file
      const jsonFile = await convertJsonlToJson(request.outputFile);

      // Save the last entry as raw_result.json
      await saveLastEntryAsRawResult(jsonFile);

      if (resultMessage) {
        // Extract session_id from result message
        const sessionId = resultMessage.session_id || null;

        // Check if there was an error in the result
        const isError = resultMessage.is_error || false;
        const subtype = resultMessage.subtype || '';

        // Handle error_during_execution case where there's no result field
        if (subtype === 'error_during_execution') {
          const errorMsg =
            'Error during execution: Agent encountered an error and did not return a result';
          return {
            output: errorMsg,
            success: false,
            sessionId,
            retryCode: RetryCode.ERROR_DURING_EXECUTION,
          };
        }

        let resultText = resultMessage.result || '';

        // For error cases, truncate the output to prevent JSONL blobs
        if (isError && resultText.length > 1000) {
          resultText = truncateOutput(resultText, 800);
        }

        return {
          output: resultText,
          success: !isError,
          sessionId,
          retryCode: RetryCode.NONE, // No retry needed for successful or non-retryable errors
        };
      } else {
        // No result message found, try to extract meaningful error
        let errorMsgText = 'No result message found in Claude Code output';

        // Try to get the last few lines of output for context
        try {
          const file = Bun.file(request.outputFile);
          const text = await file.text();
          const lines = text.split('\n').filter((l) => l.trim());

          if (lines.length > 0) {
            // Get last 5 lines or less
            const lastLines = lines.slice(-5);
            // Try to parse each as JSON to find any error messages
            for (let i = lastLines.length - 1; i >= 0; i--) {
              const line = lastLines[i];
              if (!line) continue;
              try {
                const data = JSON.parse(line);
                if (data.type === 'assistant' && data.message) {
                  // Extract text from assistant message
                  const content = data.message.content || [];
                  if (Array.isArray(content) && content.length > 0) {
                    const text = content[0].text || '';
                    if (text) {
                      errorMsgText = `Claude Code output: ${text.slice(0, 500)}`; // Truncate
                      break;
                    }
                  }
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        } catch {
          // Ignore file read errors
        }

        return {
          output: truncateOutput(errorMsgText, 800),
          success: false,
          sessionId: null,
          retryCode: RetryCode.NONE,
        };
      }
    } else {
      // Error occurred - stderr is captured, stdout went to file
      const stderrMsg = stderr.trim();

      // Try to read the output file to check for errors in stdout
      let stdoutMsg = '';
      let errorFromJsonl: string | null = null;

      try {
        const file = Bun.file(request.outputFile);
        if (await file.exists()) {
          // Parse JSONL to find error message
          const [messages, resultMessage] = await parseJsonlOutput(request.outputFile);

          if (resultMessage && resultMessage.is_error) {
            // Found error in result message
            errorFromJsonl = resultMessage.result || 'Unknown error';
          } else if (messages.length > 0) {
            // Look for error in last few messages
            const lastMessages = messages.slice(-5);
            for (let i = lastMessages.length - 1; i >= 0; i--) {
              const msg = lastMessages[i];
              if (msg && msg.type === 'assistant' && msg.message?.content) {
                const content = msg.message.content;
                if (Array.isArray(content) && content.length > 0) {
                  const textItem = content[0];
                  const text = textItem?.text || '';
                  if (
                    text &&
                    (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed'))
                  ) {
                    errorFromJsonl = text.slice(0, 500); // Truncate
                    break;
                  }
                }
              }
            }
          }

          // If no structured error found, get last line only
          if (!errorFromJsonl) {
            const text = await file.text();
            const lines = text.split('\n').filter((l) => l.trim());
            if (lines.length > 0) {
              const lastLine = lines[lines.length - 1];
              stdoutMsg = lastLine ? lastLine.slice(0, 200) : ''; // Truncate to 200 chars
            }
          }
        }
      } catch {
        // Ignore errors
      }

      let finalErrorMsg: string;
      if (errorFromJsonl) {
        finalErrorMsg = `Claude Code error: ${errorFromJsonl}`;
      } else if (stdoutMsg && !stderrMsg) {
        finalErrorMsg = `Claude Code error: ${stdoutMsg}`;
      } else if (stderrMsg && !stdoutMsg) {
        finalErrorMsg = `Claude Code error: ${stderrMsg}`;
      } else if (stdoutMsg && stderrMsg) {
        finalErrorMsg = `Claude Code error: ${stderrMsg}\nStdout: ${stdoutMsg}`;
      } else {
        finalErrorMsg = `Claude Code error: Command failed with exit code ${exitCode}`;
      }

      // Always truncate error messages to prevent huge outputs
      return {
        output: truncateOutput(finalErrorMsg, 800),
        success: false,
        sessionId: null,
        retryCode: RetryCode.CLAUDE_CODE_ERROR,
      };
    }
  } catch (error: any) {
    const errorMsg = `Error executing Claude Code: ${error.message} (output_file=${request.outputFile}, working_dir=${request.workingDir})`;
    return {
      output: errorMsg,
      success: false,
      sessionId: null,
      retryCode: RetryCode.EXECUTION_ERROR,
    };
  }
}

/**
 * Execute Claude Code with retry logic for certain error types.
 */
export async function promptClaudeCodeWithRetry(
  request: AgentPromptRequest,
  maxRetries: number = 3,
  retryDelays: number[] = [1, 3, 5]
): Promise<AgentPromptResponse> {
  // Ensure we have enough delays for max_retries
  const delays = [...retryDelays];
  while (delays.length < maxRetries) {
    const lastDelay = delays[delays.length - 1];
    delays.push((lastDelay || 5) + 2); // Add incrementing delays
  }

  let lastResponse: AgentPromptResponse | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // +1 for initial attempt
    if (attempt > 0) {
      // This is a retry
      const delay = delays[attempt - 1] || 5;
      await Bun.sleep(delay * 1000);
    }

    const response = await promptClaudeCode(request);
    lastResponse = response;

    // Check if we should retry based on the retry code
    if (response.success || response.retryCode === RetryCode.NONE) {
      // Success or non-retryable error
      return response;
    }

    // Check if this is a retryable error
    if (
      [
        RetryCode.CLAUDE_CODE_ERROR,
        RetryCode.TIMEOUT_ERROR,
        RetryCode.EXECUTION_ERROR,
        RetryCode.ERROR_DURING_EXECUTION,
      ].includes(response.retryCode)
    ) {
      if (attempt < maxRetries) {
        continue;
      } else {
        return response;
      }
    }
  }

  // Should not reach here, but return last response just in case
  return lastResponse!;
}

/**
 * Execute a Claude Code template with slash command and arguments.
 *
 * Example:
 * ```typescript
 * const request: AgentTemplateRequest = {
 *   agentName: "planner",
 *   slashCommand: "/implement",
 *   args: ["plan.md"],
 *   adwId: "abc12345",
 *   model: "sonnet"
 * };
 * const response = await executeTemplate(request);
 * ```
 */
export async function executeTemplate(request: AgentTemplateRequest): Promise<AgentPromptResponse> {
  // Construct prompt from slash command and args
  const prompt = `${request.slashCommand} ${request.args.join(' ')}`;

  // Create output directory with adw_id at project root
  const projectRoot = process.cwd();
  const outputDir = join(projectRoot, 'agents', request.adwId, request.agentName);

  // Create directory
  await Bun.write(join(outputDir, '.gitkeep'), '');

  // Build output file path
  const outputFile = join(outputDir, OUTPUT_JSONL);

  // Create prompt request with specific parameters
  const promptRequest: AgentPromptRequest = {
    prompt,
    adwId: request.adwId,
    agentName: request.agentName,
    model: request.model || 'sonnet',
    dangerouslySkipPermissions: true,
    outputFile,
    ...(request.workingDir && { workingDir: request.workingDir }), // Only include if defined
  };

  // Execute with retry logic and return response
  return await promptClaudeCodeWithRetry(promptRequest);
}

/**
 * Get only the required environment variables for Claude Code execution.
 * This is a wrapper around getSafeSubprocessEnv() for backward compatibility.
 */
export function getClaudeEnv(): Record<string, string> {
  return getSafeSubprocessEnv();
}
