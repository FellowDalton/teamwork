import { createClientFromEnv } from './client.ts';

const client = createClientFromEnv(true);

// Try updating with different date formats
const taskId = 26796666;

try {
  // Try with startAt/dueAt
  const result = await client.patch(`/projects/api/v3/tasks/${taskId}.json`, {
    task: {
      startAt: '2026-01-29',
      dueAt: '2026-01-30',
    }
  });
  console.log('Success:', result);
} catch (e: any) {
  console.log('Error:', e.body || e.message);
}
