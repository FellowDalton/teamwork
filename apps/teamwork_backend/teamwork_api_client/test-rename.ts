import { createClientFromEnv } from './client.ts';

const client = createClientFromEnv(true);

// Try V1 API for renaming tasklist
const tasklistId = 2039119;
const newName = "Sprint 5: NextPage PIM Integration";

try {
  // V1 API uses PUT /tasklists/{id}.json
  const result = await client.put(`/tasklists/${tasklistId}.json`, {
    'todo-list': { name: newName }
  });
  console.log('Success:', result);
} catch (e: any) {
  console.log('Error:', e.body || e.message);
}
