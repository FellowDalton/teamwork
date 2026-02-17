#!/usr/bin/env bun
/**
 * Fix task dates to skip weekends (Saturday/Sunday).
 * Timeline: Jan 29, 2026 - Mar 20, 2026 (weekdays only)
 */

import { createClientFromEnv } from './client.ts';
import { TasksResource } from './resources/tasks.ts';

const PROJECT_ID = 806824;
const DEADLINE = new Date('2026-03-20');
const START_DATE = new Date('2026-01-29');

// Get next weekday (skip Saturday=6, Sunday=0)
function nextWeekday(date: Date): Date {
  const result = new Date(date);
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

// Add N weekdays to a date
function addWeekdays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added++;
    }
  }
  return result;
}

// Count weekdays between two dates
function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

async function main() {
  const client = createClientFromEnv(true);
  const tasks = new TasksResource(client);

  // Calculate total weekdays available
  const totalWeekdays = countWeekdays(START_DATE, DEADLINE);
  console.log(`Timeline: ${START_DATE.toISOString().split('T')[0]} to ${DEADLINE.toISOString().split('T')[0]}`);
  console.log(`Total weekdays available: ${totalWeekdays}`);

  // Fetch all tasks
  console.log(`\nFetching tasks for project ${PROJECT_ID}...`);
  let allTasks: Array<{ id: number; name: string }> = [];
  let page = 1;
  while (true) {
    const response = await tasks.listByProject(PROJECT_ID, { pageSize: 250, page });
    allTasks = allTasks.concat(response.tasks);
    if (response.tasks.length < 250) break;
    page++;
  }

  // Sort tasks by ID (which reflects creation order = story order)
  allTasks.sort((a, b) => a.id - b.id);

  const totalTasks = allTasks.length;
  console.log(`Found ${totalTasks} tasks`);

  // Build list of all weekdays in the range
  const weekdayList: Date[] = [];
  let current = new Date(START_DATE);
  while (current <= DEADLINE) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      weekdayList.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  console.log(`Available weekdays: ${weekdayList.length}`);

  // Distribute tasks across weekdays proportionally
  // Each task gets a start/due based on its position in the total
  let updated = 0;

  console.log('\nUpdating task dates (skipping weekends)...\n');

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];

    // Calculate start and end indices in weekdayList
    const startIdx = Math.floor((i / totalTasks) * weekdayList.length);
    const endIdx = Math.min(
      Math.floor(((i + 1) / totalTasks) * weekdayList.length),
      weekdayList.length - 1
    );

    const startDate = weekdayList[startIdx];
    const dueDate = weekdayList[Math.max(startIdx, endIdx)]; // Due must be >= start

    const startStr = startDate.toISOString().split('T')[0];
    const dueStr = dueDate.toISOString().split('T')[0];

    try {
      await tasks.update(task.id, {
        startDate: startStr,
        dueDate: dueStr,
      });
      updated++;
      process.stdout.write(`\r  Updated ${updated}/${totalTasks}: ${task.name.substring(0, 50)}...`);
    } catch (error) {
      console.error(`\n  Failed to update task ${task.id}: ${(error as Error).message}`);
    }
  }

  console.log(`\n\nDone! Updated ${updated} tasks with weekday-only dates.`);
  console.log(`First task starts: ${nextWeekday(START_DATE).toISOString().split('T')[0]}`);
  console.log(`Last task due: ${DEADLINE.toISOString().split('T')[0]}`);
}

main().catch(console.error);
