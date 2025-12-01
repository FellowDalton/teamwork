/**
 * Utility functions for ADW system.
 * TypeScript/Bun implementation of adws/adw_modules/utils.py
 */

import { z } from 'zod';
import { mkdir } from 'fs/promises';
import { existsSync, appendFileSync } from 'fs';
import path from 'path';

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger interface for dual-output logging (file + console)
 */
export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  getLogFile(): string;
}

/**
 * Logger implementation that writes to both console and file
 */
class AdwLogger implements Logger {
  private logFile: string;

  constructor(adwId: string, logFile: string, triggerType: string) {
    this.logFile = logFile;
    // Store for future use
    void adwId;
    void triggerType;
  }

  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const levelName = LogLevel[level];

    // File format: timestamp - level - message
    const fileMessage = `${timestamp} - ${levelName} - ${message}\n`;

    // Console format: just the message for INFO and above
    if (level >= LogLevel.INFO) {
      console.log(message);
    }

    // Append to log file synchronously
    try {
      appendFileSync(this.logFile, fileMessage, 'utf-8');
    } catch (error) {
      console.error(`Failed to write to log file: ${error}`);
    }
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  getLogFile(): string {
    return this.logFile;
  }
}

/**
 * Global logger registry
 */
const loggers = new Map<string, Logger>();

/**
 * Generate a short 8-character UUID for ADW tracking.
 *
 * @returns 8-character UUID string
 */
export function makeAdwId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Set up logger that writes to both console and file using adw_id.
 *
 * Creates log directory: agents/{adw_id}/{trigger_type}/
 * Log file path: agents/{adw_id}/{trigger_type}/execution.log
 *
 * @param adwId - The ADW workflow ID
 * @param triggerType - Type of trigger (adw_plan_build, trigger_webhook, etc.)
 * @returns Configured logger instance
 */
export async function setupLogger(
  adwId: string,
  triggerType: string = 'adw_plan_build'
): Promise<Logger> {
  // Get project root (assuming this file is in src/modules/)
  const projectRoot = path.resolve(import.meta.dir, '../..');

  // Create log directory: agents/{adw_id}/{trigger_type}/
  const logDir = path.join(projectRoot, 'agents', adwId, triggerType);
  await mkdir(logDir, { recursive: true });

  // Log file path: agents/{adw_id}/{trigger_type}/execution.log
  const logFile = path.join(logDir, 'execution.log');

  // Create logger instance
  const logger = new AdwLogger(adwId, logFile, triggerType);

  // Store in registry
  loggers.set(adwId, logger);

  // Log initial setup message
  logger.info(`ADW Logger initialized - ID: ${adwId}`);
  logger.debug(`Log file: ${logFile}`);

  return logger;
}

/**
 * Get existing logger by ADW ID.
 *
 * @param adwId - The ADW workflow ID
 * @returns Logger instance
 * @throws Error if logger not found
 */
export function getLogger(adwId: string): Logger {
  const logger = loggers.get(adwId);
  if (!logger) {
    throw new Error(`Logger not found for ADW ID: ${adwId}`);
  }
  return logger;
}

/**
 * Parse JSON that may be wrapped in markdown code blocks (with schema validation).
 *
 * @param text - String containing JSON, possibly wrapped in markdown
 * @param schema - Zod schema to validate/parse the result
 * @returns Parsed JSON object validated with Zod schema
 */
export function parseJson<T extends z.ZodType>(text: string, schema: T): z.infer<T>;

/**
 * Parse JSON that may be wrapped in markdown code blocks (without schema validation).
 *
 * @param text - String containing JSON, possibly wrapped in markdown
 * @returns Parsed JSON object
 */
export function parseJson(text: string): unknown;

/**
 * Parse JSON that may be wrapped in markdown code blocks.
 *
 * Handles various formats:
 * - Raw JSON
 * - JSON wrapped in ```json ... ```
 * - JSON wrapped in ``` ... ```
 * - JSON with extra whitespace or newlines
 *
 * @param text - String containing JSON, possibly wrapped in markdown
 * @param schema - Optional Zod schema to validate/parse the result
 * @returns Parsed JSON object, optionally validated with Zod schema
 * @throws Error if JSON cannot be parsed or validation fails
 *
 * @example
 * ```typescript
 * const data = parseJson(text, MySchema);
 * // data is fully typed as z.infer<typeof MySchema>
 * ```
 */
export function parseJson<T extends z.ZodType>(text: string, schema?: T): unknown {
  // Try to extract JSON from markdown code blocks
  // Pattern matches ```json\n...\n``` or ```\n...\n```
  const codeBlockPattern = /```(?:json)?\s*\n(.*?)\n```/s;
  const match = text.match(codeBlockPattern);

  let jsonStr: string;
  if (match?.[1]) {
    jsonStr = match[1].trim();
  } else {
    // No code block found, try to parse the entire text
    jsonStr = text.trim();
  }

  // Try to find JSON array or object boundaries if not already clean
  if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
    // Look for JSON array (prefer arrays as they're more common in API responses)
    const arrayStart = jsonStr.indexOf('[');
    const arrayEnd = jsonStr.lastIndexOf(']');

    // Look for JSON object
    const objStart = jsonStr.indexOf('{');
    const objEnd = jsonStr.lastIndexOf('}');

    // Determine which comes first and extract accordingly
    if (arrayStart !== -1 && (objStart === -1 || arrayStart < objStart)) {
      if (arrayEnd !== -1) {
        jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
      }
    } else if (objStart !== -1) {
      if (objEnd !== -1) {
        jsonStr = jsonStr.slice(objStart, objEnd + 1);
      }
    }
  }

  // Additional fallback: if still no valid JSON start, try more aggressive extraction
  // This handles cases where there's prose before the JSON
  if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
    // Look for first occurrence of [ or { and last occurrence of ] or }
    const firstArrayIndex = jsonStr.indexOf('[');
    const firstObjIndex = jsonStr.indexOf('{');
    const lastArrayIndex = jsonStr.lastIndexOf(']');
    const lastObjIndex = jsonStr.lastIndexOf('}');

    // Find which delimiter appears first
    const startIndex =
      firstArrayIndex !== -1 && (firstObjIndex === -1 || firstArrayIndex < firstObjIndex)
        ? firstArrayIndex
        : firstObjIndex;

    // Find which delimiter appears last
    const endIndex =
      lastArrayIndex !== -1 && lastArrayIndex > lastObjIndex
        ? lastArrayIndex
        : lastObjIndex;

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      jsonStr = jsonStr.slice(startIndex, endIndex + 1);
    }
  }

  try {
    const result = JSON.parse(jsonStr);

    // If schema is provided, validate with Zod
    if (schema) {
      return schema.parse(result);
    }

    return result;
  } catch (error) {
    const preview = jsonStr.slice(0, 200);
    if (error instanceof z.ZodError) {
      throw new Error(`Zod validation failed: ${error.message}. JSON was: ${preview}...`);
    } else {
      throw new Error(`Failed to parse JSON: ${error}. Text was: ${preview}...`);
    }
  }
}

/**
 * Check that required environment variables are set.
 *
 * NOTE: ANTHROPIC_API_KEY is not required by default because Claude Code
 * subscriptions don't need it. Only check for it if you're using API mode.
 *
 * @param requiredVars - Array of required environment variable names
 * @param logger - Optional logger instance for error reporting
 * @returns Object with missing variable names (empty array if all present)
 *
 * @example
 * ```typescript
 * const { missing } = checkEnvVars(["CLAUDE_CODE_PATH"], logger);
 * if (missing.length > 0) {
 *   process.exit(1);
 * }
 * ```
 */
export function checkEnvVars(
  requiredVars: string[] = ['CLAUDE_CODE_PATH'],
  logger?: Logger
): { missing: string[] } {
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    const errorMsg = 'Error: Missing required environment variables:';
    if (logger) {
      logger.error(errorMsg);
      missing.forEach((varName) => logger.error(`  - ${varName}`));
    } else {
      console.error(errorMsg);
      missing.forEach((varName) => console.error(`  - ${varName}`));
    }
  }

  return { missing };
}

/**
 * Format a status message for agent operations with visibility into ADW ID and branch.
 *
 * Note: Rich markup (bold, colors) is stripped in Bun console output for simplicity.
 * Use ANSI codes if terminal formatting is required.
 *
 * @param action - The action being performed (e.g., "Building solution", "Creating plan")
 * @param adwId - The ADW ID for tracking
 * @param worktree - The worktree/branch name
 * @param phase - Optional phase name (e.g., "build", "plan", "implement")
 * @returns Formatted status message with ADW ID and branch visibility
 */
export function formatAgentStatus(
  action: string,
  adwId: string,
  worktree: string,
  phase?: string
): string {
  // Format the ADW ID (first 6 chars for brevity)
  const shortId = adwId.length > 6 ? adwId.slice(0, 6) : adwId;

  // Build the status components (simplified, no rich markup)
  let statusMsg = `${action} (${shortId}@${worktree}`;

  if (phase) {
    statusMsg += ` • ${phase}`;
  }

  statusMsg += ')';

  return statusMsg;
}

/**
 * Format a status message specifically for worktree operations.
 *
 * @param action - The action being performed (e.g., "Creating", "Initializing")
 * @param worktree - The worktree name
 * @param adwId - Optional ADW ID for tracking
 * @returns Formatted status message for worktree operations
 */
export function formatWorktreeStatus(action: string, worktree: string, adwId?: string): string {
  let baseMsg = `${action} worktree '${worktree}'`;

  if (adwId) {
    const shortId = adwId.length > 6 ? adwId.slice(0, 6) : adwId;
    baseMsg += ` (${shortId})`;
  }

  return baseMsg;
}

/**
 * Get filtered environment variables safe for subprocess execution.
 *
 * Returns only the environment variables needed for ADW workflows based on
 * .env.sample configuration. This prevents accidental exposure of sensitive
 * credentials to subprocesses.
 *
 * @returns Object containing only required environment variables
 */
export function getSafeSubprocessEnv(): Record<string, string> {
  const safeEnvVars: Record<string, string | undefined> = {
    // NOTE: ANTHROPIC_API_KEY is intentionally NOT included here!
    // When running Claude Code with a subscription, passing ANTHROPIC_API_KEY
    // forces it into API mode which consumes credits instead of using the subscription.
    // Only pass this if you explicitly want API mode.

    // GitHub Configuration (optional)
    // GITHUB_PAT is optional - if not set, will use default gh auth
    GITHUB_PAT: process.env.GITHUB_PAT,

    // Claude Code Configuration
    CLAUDE_CODE_PATH: process.env.CLAUDE_CODE_PATH || 'claude',
    CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR:
      process.env.CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR || 'true',

    // Agent Cloud Sandbox Environment (optional)
    E2B_API_KEY: process.env.E2B_API_KEY,

    // Cloudflare tunnel token (optional)
    CLOUDFLARED_TUNNEL_TOKEN: process.env.CLOUDFLARED_TUNNEL_TOKEN,

    // Essential system environment variables
    HOME: process.env.HOME,
    USER: process.env.USER,
    PATH: process.env.PATH,
    SHELL: process.env.SHELL,
    TERM: process.env.TERM,
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,

    // Node/Bun-specific variables that subprocesses might need
    NODE_ENV: process.env.NODE_ENV,
    BUN_INSTALL: process.env.BUN_INSTALL,

    // Working directory tracking
    PWD: process.cwd(),
  };

  // Add GH_TOKEN as alias for GITHUB_PAT if it exists
  const githubPat = process.env.GITHUB_PAT;
  if (githubPat) {
    safeEnvVars.GH_TOKEN = githubPat;
  }

  // Filter out undefined values
  return Object.fromEntries(
    Object.entries(safeEnvVars).filter(([_, v]) => v !== undefined)
  ) as Record<string, string>;
}

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated string with ellipsis if needed
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Ensure a directory exists, creating it if necessary.
 *
 * @param dirPath - Path to the directory
 * @returns Promise that resolves when directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Check if a file exists.
 *
 * @param filePath - Path to the file
 * @returns True if file exists, false otherwise
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Format a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2.5s", "1m 30s", "1h 15m")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else if (seconds > 0) {
    const remainingMs = ms % 1000;
    const decimalSeconds = seconds + remainingMs / 1000;
    return `${decimalSeconds.toFixed(1)}s`;
  } else {
    return `${ms}ms`;
  }
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Return a simple goodbye message.
 *
 * @returns The string 'Goodbye!'
 */
export function goodbye(): string {
  return 'Goodbye!';
}
