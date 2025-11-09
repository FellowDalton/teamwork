#!/usr/bin/env bun
/**
 * Execute Claude Code slash commands from the command line.
 * TypeScript/Bun port of adws/adw_slash_command.py
 *
 * Usage:
 *   # Direct execution
 *   ./src/cli/adw-slash-command.ts /chore "Update documentation"
 *
 *   # Using bun run
 *   bun run slash /implement specs/plan.md
 *
 * Examples:
 *   # Run a slash command
 *   ./src/cli/adw-slash-command.ts /chore "Add logging to agent.py"
 *
 *   # Run with specific model
 *   ./src/cli/adw-slash-command.ts /implement plan.md --model opus
 *
 *   # Run from a different working directory
 *   ./src/cli/adw-slash-command.ts /test --working-dir /path/to/project
 *
 *   # JSON output mode
 *   ./src/cli/adw-slash-command.ts /review --json
 */

import { Command } from 'commander';
import { join } from 'path';
import { executeTemplate, generateShortId, OUTPUT_JSONL, OUTPUT_JSON, FINAL_OBJECT_JSON, SUMMARY_JSON } from '@/modules/agent';
import { setupLogger, formatDuration } from '@/modules/utils';
import type { AgentTemplateRequest, AgentPromptResponse } from '@/modules/data-models';

// ANSI color codes for rich terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

/**
 * Format text with color and style
 */
function styled(text: string, style: keyof typeof colors): string {
  return `${colors[style]}${text}${colors.reset}`;
}

/**
 * Print a formatted panel with title and content
 */
function printPanel(title: string, content: string, borderColor: keyof typeof colors = 'blue'): void {
  const border = '─'.repeat(60);
  console.log(`\n${colors[borderColor]}┌${border}┐${colors.reset}`);
  console.log(`${colors[borderColor]}│${colors.reset} ${styled(title, 'bold')}`);
  console.log(`${colors[borderColor]}├${border}┤${colors.reset}`);
  console.log(content);
  console.log(`${colors[borderColor]}└${border}┘${colors.reset}\n`);
}

/**
 * Print a simple table with key-value pairs
 */
function printTable(rows: Array<[string, string]>): void {
  const maxKeyLength = Math.max(...rows.map(([key]) => key.length));
  rows.forEach(([key, value]) => {
    const padding = ' '.repeat(maxKeyLength - key.length);
    console.log(`  ${styled(key + ':', 'cyan')}${padding} ${value}`);
  });
}

/**
 * Print files table with descriptions
 */
function printFilesTable(files: Array<[string, string, string]>): void {
  console.log(`  ${styled('File Type', 'cyan')}          ${styled('Description', 'dim')}`);
  console.log(`  ${'─'.repeat(70)}`);
  files.forEach(([type, path, description]) => {
    console.log(`  ${styled(type.padEnd(18), 'cyan')} ${styled(description, 'dim')}`);
    console.log(`    ${styled(path, 'dim')}`);
  });
}

const program = new Command();

program
  .name('adw-slash-command')
  .description('Execute Claude Code slash commands')
  .argument('<command>', 'Slash command (e.g., /build, /plan_vite_vue)')
  .argument('[args...]', 'Arguments for the command')
  .option('-m, --model <model>', 'Model to use (sonnet|opus)', 'sonnet')
  .option('-w, --working-dir <dir>', 'Working directory', process.cwd())
  .option('-a, --agent-name <name>', 'Agent name for logging', 'executor')
  .option('--json', 'Output results as JSON')
  .version('1.0.0')
  .action(async (command: string, args: string[], options) => {
    const startTime = Date.now();
    const adwId = generateShortId();
    const logger = await setupLogger(adwId, options.agentName);

    // Validate model choice
    if (!['sonnet', 'opus'].includes(options.model)) {
      console.error(styled('Error: Invalid model. Must be "sonnet" or "opus"', 'red'));
      process.exit(1);
    }

    // Ensure command starts with /
    const slashCommand = command.startsWith('/') ? command : `/${command}`;

    // Create the template request
    const request: AgentTemplateRequest = {
      agentName: options.agentName,
      slashCommand,
      args,
      adwId,
      model: options.model,
      workingDir: options.workingDir,
    };

    // Show execution info (unless JSON mode)
    if (!options.json) {
      const inputRows: Array<[string, string]> = [
        ['ADW ID', adwId],
        ['ADW Name', 'adw_slash_command'],
        ['Command', slashCommand],
        ['Args', args.length > 0 ? args.join(' ') : '(none)'],
        ['Model', options.model],
        ['Working Dir', options.workingDir],
      ];

      printPanel('🚀 Inputs', '', 'blue');
      printTable(inputRows);
      console.log();

      // Show status message
      console.log(styled('Executing command...', 'yellow'));
      console.log();
    }

    try {
      // Execute the slash command
      logger.info(`Executing slash command: ${slashCommand} ${args.join(' ')}`);
      const response: AgentPromptResponse = await executeTemplate(request);

      const duration = Date.now() - startTime;

      // Output files are in agents/<adw_id>/<agent_name>/
      const outputDir = join(process.cwd(), 'agents', adwId, options.agentName);

      // Create summary file
      const simpleJsonOutput = join(outputDir, SUMMARY_JSON);

      // Determine the template file path
      const commandName = slashCommand.replace(/^\//, ''); // Remove leading slash
      const pathToSlashCommandPrompt = `.claude/commands/${commandName}.md`;

      await Bun.write(
        simpleJsonOutput,
        JSON.stringify(
          {
            adwId,
            slashCommand,
            args,
            pathToSlashCommandPrompt,
            model: options.model,
            workingDir: options.workingDir,
            success: response.success,
            sessionId: response.sessionId,
            retryCode: response.retryCode,
            output: response.output,
            durationMs: duration,
          },
          null,
          2
        )
      );

      // JSON output mode
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: response.success,
              adwId,
              command: slashCommand,
              args,
              output: response.output,
              durationMs: duration,
              sessionId: response.sessionId,
              retryCode: response.retryCode,
            },
            null,
            2
          )
        );
        process.exit(response.success ? 0 : 1);
      }

      // Rich terminal output
      if (response.success) {
        printPanel('✅ Success', response.output, 'green');
        if (response.sessionId) {
          console.log(`  ${styled('Session ID:', 'cyan')} ${response.sessionId}`);
        }
      } else {
        printPanel('❌ Failed', response.output, 'red');
        if (response.retryCode !== 'none') {
          console.log(`  ${styled('Retry Code:', 'yellow')} ${response.retryCode}`);
        }
      }

      // Show execution time
      console.log(`  ${styled('Duration:', 'cyan')} ${formatDuration(duration)}\n`);

      // Files saved panel
      const files: Array<[string, string, string]> = [
        ['JSONL Stream', join(outputDir, OUTPUT_JSONL), 'Raw streaming output from Claude Code'],
        ['JSON Array', join(outputDir, OUTPUT_JSON), 'All messages as a JSON array'],
        ['Final Object', join(outputDir, FINAL_OBJECT_JSON), 'Last message entry (final result)'],
        ['Summary', simpleJsonOutput, 'High-level execution summary with metadata'],
      ];

      printPanel('📄 Output Files', '', 'blue');
      printFilesTable(files);

      logger.info(`Execution completed: ${response.success ? 'SUCCESS' : 'FAILED'}`);
      process.exit(response.success ? 0 : 1);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: false,
              adwId,
              command: slashCommand,
              args,
              error: error.message,
              durationMs: duration,
            },
            null,
            2
          )
        );
      } else {
        printPanel('❌ Unexpected Error', error.message, 'red');
        console.log(`  ${styled('Duration:', 'cyan')} ${formatDuration(duration)}\n`);
      }

      logger.error(`Unexpected error: ${error.message}`);
      process.exit(2);
    }
  });

program.parse();
