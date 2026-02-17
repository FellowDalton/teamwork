#!/usr/bin/env bun
/**
 * Assign dates and Nikolas Dalton to newly created PM project tasks.
 */

import { createClientFromEnv } from './client.ts';
import { TasksResource } from './resources/tasks.ts';

const NIKOLAS_USER_ID = 366085;

// Sprint tasklists with their date ranges (weekdays only, matching AI Development timeline)
const SPRINTS = [
  { tasklistId: 2040218, name: "Sprint 1", startDate: "2026-01-29", dueDate: "2026-02-03" },
  { tasklistId: 2040219, name: "Sprint 2", startDate: "2026-02-04", dueDate: "2026-02-13" },
  { tasklistId: 2040220, name: "Sprint 3", startDate: "2026-02-10", dueDate: "2026-02-16" },
  { tasklistId: 2040221, name: "Sprint 4", startDate: "2026-02-16", dueDate: "2026-02-24" },
  { tasklistId: 2040222, name: "Sprint 6", startDate: "2026-03-03", dueDate: "2026-03-12" },
  { tasklistId: 2040223, name: "Sprint 7", startDate: "2026-03-12", dueDate: "2026-03-18" },
];

async function main() {
  const client = createClientFromEnv(true);
  const tasks = new TasksResource(client);

  console.log("Assigning dates and Nikolas Dalton to PM project tasks...\n");

  let totalUpdated = 0;

  for (const sprint of SPRINTS) {
    console.log(`Processing ${sprint.name} (${sprint.startDate} - ${sprint.dueDate})...`);

    const tasksResponse = await tasks.listByTasklist(sprint.tasklistId, { pageSize: 50 });

    for (const task of tasksResponse.tasks) {
      await tasks.update(task.id, {
        startDate: sprint.startDate,
        dueDate: sprint.dueDate,
        assigneeUserIds: [NIKOLAS_USER_ID],
      });
      console.log(`  Updated: ${task.name}`);
      totalUpdated++;
    }
  }

  console.log(`\nDone! Updated ${totalUpdated} tasks with dates and assignment.`);
}

main().catch(console.error);
