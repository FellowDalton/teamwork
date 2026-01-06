#!/usr/bin/env bun
/**
 * Register a Teamwork webhook for task events
 * 
 * Usage:
 *   bun scripts/webhooks/register-webhook.ts <ngrok-url> [options]
 * 
 * Examples:
 *   # Register for TASK.MOVED events
 *   bun scripts/webhooks/register-webhook.ts https://abc123.ngrok.io
 * 
 *   # Register for all task events
 *   bun scripts/webhooks/register-webhook.ts https://abc123.ngrok.io --all-events
 * 
 *   # Register for a specific project
 *   bun scripts/webhooks/register-webhook.ts https://abc123.ngrok.io --project-id=123456
 * 
 *   # List existing webhooks
 *   bun scripts/webhooks/register-webhook.ts --list
 * 
 *   # Delete a webhook
 *   bun scripts/webhooks/register-webhook.ts --delete=12345
 */

import { createTeamworkClient } from '../../apps/teamwork_api_client/src/index.ts';

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  list: args.includes('--list'),
  allEvents: args.includes('--all-events'),
  projectId: args.find(a => a.startsWith('--project-id='))?.split('=')[1],
  deleteId: args.find(a => a.startsWith('--delete='))?.split('=')[1],
  help: args.includes('--help') || args.includes('-h'),
};
const ngrokUrl = args.find(a => !a.startsWith('--'));

// Show help
if (flags.help) {
  console.log(`
Teamwork Webhook Registration Tool

Usage:
  bun scripts/webhooks/register-webhook.ts <ngrok-url> [options]

Options:
  --list              List all registered webhooks
  --all-events        Register for all task events (not just MOVED)
  --project-id=ID     Register webhook for specific project only
  --delete=ID         Delete a webhook by ID
  --help, -h          Show this help message

Examples:
  # Start tunnel first
  ./scripts/webhooks/start-tunnel.sh

  # Register for TASK.MOVED events
  bun scripts/webhooks/register-webhook.ts https://abc123.ngrok.io

  # List existing webhooks
  bun scripts/webhooks/register-webhook.ts --list
`);
  process.exit(0);
}

// Initialize client
const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
  debug: false,
});

async function main() {
  console.log('');
  console.log('==============================================');
  console.log('  Teamwork Webhook Registration');
  console.log('==============================================');
  console.log('');

  // List webhooks
  if (flags.list) {
    console.log('Fetching registered webhooks...');
    try {
      const response = await client.webhooks.list();
      
      if (!response.webhooks || response.webhooks.length === 0) {
        console.log('No webhooks registered.');
      } else {
        console.log(`Found ${response.webhooks.length} webhook(s):\n`);
        for (const webhook of response.webhooks) {
          console.log(`  ID: ${webhook.id}`);
          console.log(`  Event: ${webhook.event}`);
          console.log(`  URL: ${webhook.url}`);
          console.log(`  Status: ${webhook.status}`);
          console.log('  ---');
        }
      }
    } catch (err) {
      console.error('Error fetching webhooks:', err);
    }
    return;
  }

  // Delete webhook
  if (flags.deleteId) {
    console.log(`Deleting webhook ${flags.deleteId}...`);
    try {
      await client.webhooks.delete(parseInt(flags.deleteId));
      console.log('Webhook deleted successfully.');
    } catch (err) {
      console.error('Error deleting webhook:', err);
    }
    return;
  }

  // Register webhook
  if (!ngrokUrl) {
    console.error('Error: No ngrok URL provided.');
    console.log('');
    console.log('Usage: bun scripts/webhooks/register-webhook.ts <ngrok-url>');
    console.log('');
    console.log('First, start the ngrok tunnel:');
    console.log('  ./scripts/webhooks/start-tunnel.sh');
    console.log('');
    console.log('Then use the provided URL.');
    process.exit(1);
  }

  const webhookUrl = `${ngrokUrl.replace(/\/$/, '')}/api/webhooks/teamwork`;
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const projectId = flags.projectId ? parseInt(flags.projectId) : undefined;

  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`Project ID: ${projectId || 'Site-level (all projects)'}`);
  console.log(`Secret: ${webhookSecret ? 'Configured' : 'Not set (WEBHOOK_SECRET env var)'}`);
  console.log('');

  try {
    if (flags.allEvents) {
      console.log('Registering webhooks for all task events...');
      const results = await client.webhooks.createAllTaskWebhooks(webhookUrl, {
        token: webhookSecret,
        projectId,
      });
      console.log(`Created ${results.length} webhooks.`);
      for (const result of results) {
        console.log(`  - ${result.webhook.event} (ID: ${result.webhook.id})`);
      }
    } else {
      console.log('Registering webhook for TASK.MOVED events...');
      const result = await client.webhooks.createTaskMovedWebhook(webhookUrl, {
        token: webhookSecret,
        projectId,
      });
      console.log(`Webhook created successfully!`);
      console.log(`  ID: ${result.webhook.id}`);
      console.log(`  Event: ${result.webhook.event}`);
      console.log(`  URL: ${result.webhook.url}`);
    }

    console.log('');
    console.log('Webhook registered! Now when tasks are moved in Teamwork,');
    console.log('events will be sent to your local server via ngrok.');
    console.log('');
    console.log('View incoming events:');
    console.log(`  curl http://localhost:3001/api/webhooks/events`);
    console.log('');

  } catch (err) {
    console.error('Error registering webhook:', err);
    process.exit(1);
  }
}

main();
