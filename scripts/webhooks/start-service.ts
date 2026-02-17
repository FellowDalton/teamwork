#!/usr/bin/env bun
/**
 * Non-interactive webhook service starter
 *
 * Starts ngrok tunnel and registers webhook automatically.
 * Designed to be run by Claude without user interaction.
 *
 * Usage:
 *   bun scripts/webhooks/start-service.ts [options]
 *
 * Options:
 *   --all-events    Register for all task events (default: TASK.MOVED only)
 *   --project-id=ID Register for specific project only
 *   --port=PORT     Port to tunnel (default: 3001)
 *   --stop          Stop ngrok and exit
 */

import { createTeamworkClient } from '../../apps/teamwork_api_client/src/index.ts';
import { spawn } from 'bun';

// Parse args
const args = process.argv.slice(2);
const flags = {
  allEvents: args.includes('--all-events'),
  projectId: args.find(a => a.startsWith('--project-id='))?.split('=')[1],
  port: args.find(a => a.startsWith('--port='))?.split('=')[1] || '3001',
  stop: args.includes('--stop'),
};

const PORT = parseInt(flags.port);

// Colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function getNgrokUrl(): Promise<string | null> {
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    const data = await response.json() as { tunnels: Array<{ public_url: string; proto: string }> };
    const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
    return httpsTunnel?.public_url || data.tunnels[0]?.public_url || null;
  } catch {
    return null;
  }
}

async function waitForNgrok(maxAttempts = 20): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const url = await getNgrokUrl();
    if (url) return url;
    await Bun.sleep(500);
  }
  return null;
}

async function stopNgrok(): Promise<void> {
  const proc = spawn(['pkill', '-f', 'ngrok'], { stdout: 'ignore', stderr: 'ignore' });
  await proc.exited;
}

async function main() {
  // Handle --stop flag
  if (flags.stop) {
    console.log('Stopping ngrok...');
    await stopNgrok();
    console.log(green('ngrok stopped.'));
    process.exit(0);
  }

  console.log('');
  console.log(bold('Teamwork Webhook Service'));
  console.log('─'.repeat(40));

  // Check environment
  if (!process.env.TEAMWORK_API_URL || !process.env.TEAMWORK_BEARER_TOKEN) {
    console.log(red('Error: Missing TEAMWORK_API_URL or TEAMWORK_BEARER_TOKEN'));
    process.exit(1);
  }

  // Check if ngrok already running
  let ngrokUrl = await getNgrokUrl();

  if (ngrokUrl) {
    console.log(yellow(`ngrok already running: ${ngrokUrl}`));
  } else {
    // Start ngrok
    console.log(`Starting ngrok on port ${PORT}...`);

    spawn(['ngrok', 'http', String(PORT)], {
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
    });

    ngrokUrl = await waitForNgrok();

    if (!ngrokUrl) {
      console.log(red('Failed to start ngrok. Is it installed and authenticated?'));
      console.log('Run: brew install ngrok && ngrok config add-authtoken <token>');
      process.exit(1);
    }

    console.log(green(`ngrok started: ${ngrokUrl}`));
  }

  // Initialize Teamwork client
  const client = createTeamworkClient({
    apiUrl: process.env.TEAMWORK_API_URL,
    bearerToken: process.env.TEAMWORK_BEARER_TOKEN,
    debug: false,
  });

  // Check for existing webhooks with same URL pattern
  const webhookUrl = `${ngrokUrl}/api/webhooks/teamwork`;

  console.log('Checking existing webhooks...');
  const existing = await client.webhooks.list();
  const matchingWebhooks = existing.webhooks?.filter(w =>
    w.url.includes('ngrok') && w.status === 'ACTIVE'
  ) || [];

  if (matchingWebhooks.length > 0) {
    console.log(yellow(`Found ${matchingWebhooks.length} existing ngrok webhook(s)`));
    // Clean up old ngrok webhooks (they have stale URLs)
    for (const webhook of matchingWebhooks) {
      if (webhook.url !== webhookUrl) {
        console.log(`  Removing stale webhook ${webhook.id}...`);
        await client.webhooks.delete(webhook.id);
      }
    }
  }

  // Register webhook(s)
  const projectId = flags.projectId ? parseInt(flags.projectId) : undefined;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  console.log(`Registering webhook: ${webhookUrl}`);

  try {
    if (flags.allEvents) {
      const results = await client.webhooks.createAllTaskWebhooks(webhookUrl, {
        token: webhookSecret,
        projectId,
      });
      console.log(green(`Registered ${results.length} webhooks`));
      for (const r of results) {
        console.log(`  - ${r.webhook.event} (ID: ${r.webhook.id})`);
      }
    } else {
      const result = await client.webhooks.createTaskMovedWebhook(webhookUrl, {
        token: webhookSecret,
        projectId,
      });
      console.log(green(`Registered TASK.MOVED webhook (ID: ${result.webhook.id})`));
    }
  } catch (err: any) {
    // Check if it's a duplicate
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log(yellow('Webhook already registered'));
    } else {
      console.log(red(`Failed to register: ${err.message}`));
      process.exit(1);
    }
  }

  // Print summary
  console.log('');
  console.log('─'.repeat(40));
  console.log(bold(green('Webhook service is running!')));
  console.log('');
  console.log(`  Webhook URL: ${cyan(webhookUrl)}`);
  console.log(`  ngrok dashboard: ${cyan('http://127.0.0.1:4040')}`);
  console.log(`  Events: ${flags.allEvents ? 'All task events' : 'TASK.MOVED only'}`);
  console.log('');
  console.log(bold('FellowAI Integration:'));
  console.log('  Tasks tagged "FellowAI" will auto-execute when');
  console.log('  moved to "In Progress" stage.');
  console.log('');
  console.log(`Stop with: ${cyan('bun scripts/webhooks/start-service.ts --stop')}`);
  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
