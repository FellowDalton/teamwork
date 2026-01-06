#!/usr/bin/env bun
/**
 * Interactive Teamwork Webhook Setup
 * 
 * Starts ngrok tunnel and registers webhook in one command.
 * 
 * Usage:
 *   bun scripts/webhooks/setup.ts
 */

import { createTeamworkClient } from '../../apps/teamwork_api_client/src/index.ts';
import { spawn } from 'bun';

const PORT = 3001;

// Colors for terminal output
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function log(msg: string) {
  console.log(msg);
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return '';
}

async function checkNgrok(): Promise<boolean> {
  try {
    const proc = spawn(['which', 'ngrok'], { stdout: 'pipe', stderr: 'pipe' });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

async function getNgrokUrl(): Promise<string | null> {
  // ngrok exposes an API at localhost:4040
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    const data = await response.json() as { tunnels: Array<{ public_url: string; proto: string }> };
    const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
    return httpsTunnel?.public_url || data.tunnels[0]?.public_url || null;
  } catch {
    return null;
  }
}

async function waitForNgrok(maxAttempts = 30): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const url = await getNgrokUrl();
    if (url) return url;
    await Bun.sleep(500);
  }
  return null;
}

async function main() {
  console.clear();
  log(bold(cyan('==============================================')));
  log(bold(cyan('  Teamwork Webhook Setup')));
  log(bold(cyan('==============================================')));
  log('');

  // Check if ngrok is installed
  const hasNgrok = await checkNgrok();
  if (!hasNgrok) {
    log(red('Error: ngrok is not installed.'));
    log('');
    log('Install with:');
    log(cyan('  brew install ngrok'));
    log('');
    log('Then authenticate:');
    log('  1. Create free account at https://ngrok.com');
    log('  2. Get auth token from dashboard');
    log(cyan('  3. ngrok config add-authtoken <your-token>'));
    process.exit(1);
  }

  // Check if frontend server is running
  log(yellow('Step 1: Checking if frontend server is running...'));
  try {
    await fetch(`http://localhost:${PORT}/health`);
    log(green(`  ✓ Server is running on port ${PORT}`));
  } catch {
    log(red(`  ✗ Server not running on port ${PORT}`));
    log('');
    log('Start the server first:');
    log(cyan('  cd apps/teamwork_frontend && bun run server.ts'));
    log('');
    const answer = await prompt('Continue anyway? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      process.exit(1);
    }
  }
  log('');

  // Check if ngrok is already running
  log(yellow('Step 2: Starting ngrok tunnel...'));
  let ngrokUrl = await getNgrokUrl();
  
  if (ngrokUrl) {
    log(green(`  ✓ ngrok already running: ${ngrokUrl}`));
  } else {
    // Start ngrok in background
    log('  Starting ngrok...');
    const ngrokProc = spawn(['ngrok', 'http', String(PORT)], {
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
    });

    // Wait for ngrok to start
    ngrokUrl = await waitForNgrok();
    
    if (!ngrokUrl) {
      log(red('  ✗ Failed to start ngrok'));
      log('');
      log('Try running manually:');
      log(cyan(`  ngrok http ${PORT}`));
      log('');
      log('If you see auth errors, run:');
      log(cyan('  ngrok config add-authtoken <your-token>'));
      process.exit(1);
    }
    
    log(green(`  ✓ Tunnel started: ${ngrokUrl}`));
  }
  log('');

  // Initialize Teamwork client
  log(yellow('Step 3: Connecting to Teamwork...'));
  
  if (!process.env.TEAMWORK_API_URL || !process.env.TEAMWORK_BEARER_TOKEN) {
    log(red('  ✗ Missing Teamwork credentials'));
    log('');
    log('Set these in your .env file:');
    log('  TEAMWORK_API_URL=https://yoursite.teamwork.com');
    log('  TEAMWORK_BEARER_TOKEN=your-api-token');
    process.exit(1);
  }

  const client = createTeamworkClient({
    apiUrl: process.env.TEAMWORK_API_URL,
    bearerToken: process.env.TEAMWORK_BEARER_TOKEN,
    debug: false,
  });
  log(green(`  ✓ Connected to ${process.env.TEAMWORK_API_URL}`));
  log('');

  // Ask what events to register
  log(yellow('Step 4: Configure webhook...'));
  log('');
  log('Which events do you want to receive?');
  log('  1. TASK.MOVED only (recommended for board tracking)');
  log('  2. All task events (CREATED, UPDATED, MOVED, COMPLETED, etc.)');
  log('');
  
  const eventChoice = await prompt('Enter choice (1 or 2): ');
  const allEvents = eventChoice === '2';
  log('');

  // Register webhook
  log(yellow('Step 5: Registering webhook with Teamwork...'));
  
  const webhookUrl = `${ngrokUrl}/api/webhooks/teamwork`;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  try {
    if (allEvents) {
      const results = await client.webhooks.createAllTaskWebhooks(webhookUrl, {
        token: webhookSecret,
      });
      log(green(`  ✓ Registered ${results.length} webhooks`));
      for (const r of results) {
        log(`    - ${r.webhook.event} (ID: ${r.webhook.id})`);
      }
    } else {
      const result = await client.webhooks.createTaskMovedWebhook(webhookUrl, {
        token: webhookSecret,
      });
      log(green(`  ✓ Registered webhook (ID: ${result.webhook.id})`));
      log(`    Event: TASK.MOVED`);
      log(`    URL: ${webhookUrl}`);
    }
  } catch (err: any) {
    log(red(`  ✗ Failed to register webhook: ${err.message}`));
    log('');
    log('You may need to enable webhooks in Teamwork:');
    log('  Settings → Webhooks → Enable');
    process.exit(1);
  }

  log('');
  log(bold(green('==============================================')));
  log(bold(green('  Setup Complete!')));
  log(bold(green('==============================================')));
  log('');
  log('Your webhook is now active. When tasks are moved in Teamwork,');
  log('events will be sent to your local server.');
  log('');
  log(bold('Useful commands:'));
  log('');
  log('  View received events:');
  log(cyan(`    curl http://localhost:${PORT}/api/webhooks/events`));
  log('');
  log('  List all webhooks:');
  log(cyan('    bun scripts/webhooks/register-webhook.ts --list'));
  log('');
  log('  ngrok dashboard (request inspector):');
  log(cyan('    http://127.0.0.1:4040'));
  log('');
  log(yellow('Note: The ngrok URL changes when restarted.'));
  log(yellow('Run this script again if you restart ngrok.'));
  log('');
  log('Press Ctrl+C to exit (ngrok will keep running).');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
