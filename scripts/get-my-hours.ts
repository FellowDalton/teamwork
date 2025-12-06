#!/usr/bin/env bun
/**
 * Get user's logged hours for the last 7 months
 * Filtered by project: KiroViden - Klyngeplatform
 */

import { createTeamworkClient } from '../apps/teamwork_api_client/src/index.ts';

async function main() {
  const client = createTeamworkClient({
    apiUrl: process.env.TEAMWORK_API_URL!,
    bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
    debug: false,
  });

  // Calculate date range (last 7 months)
  const endDate = new Date('2025-12-06');
  const startDate = new Date('2025-05-06');

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`Fetching time entries from ${startDateStr} to ${endDateStr}...`);

  // First, get the user's ID
  const currentUser = await client.people.me();

  console.log(`Found user: ${currentUser.firstName} ${currentUser.lastName} (ID: ${currentUser.id})`);

  // Find the KiroViden project
  const projects = await client.projects.list({
    searchTerm: 'KiroViden',
    include: ['companies']
  });

  const kiroProject = projects.projects.find(p =>
    p.name.includes('KiroViden') && p.name.includes('Klyngeplatform')
  );

  if (!kiroProject) {
    console.error('Could not find project: KiroViden - Klyngeplatform');
    console.log('Available projects matching "KiroViden":');
    projects.projects.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`));
    process.exit(1);
  }

  console.log(`Found project: ${kiroProject.name} (ID: ${kiroProject.id})`);

  // Fetch all time entries for this user and project
  let allEntries: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.timeEntries.list({
      startDate: startDateStr,
      endDate: endDateStr,
      userIds: [currentUser.id],
      projectIds: [kiroProject.id],
      include: ['tasks', 'projects'],
      page,
      pageSize: 500,
      orderBy: 'date',
      orderMode: 'desc'
    });

    allEntries = allEntries.concat(response.timelogs);

    // Check if there are more pages
    if (response.timelogs.length < 500) {
      hasMore = false;
    } else {
      page++;
    }
  }

  // Calculate totals
  const totalMinutes = allEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  const totalHours = totalMinutes / 60;

  // Group by task
  const taskMap = new Map<string, { hours: number; entries: number; taskName: string }>();

  allEntries.forEach(entry => {
    const taskName = entry.task?.name || 'No Task';
    const taskId = entry.task?.id?.toString() || 'none';

    if (!taskMap.has(taskId)) {
      taskMap.set(taskId, { hours: 0, entries: 0, taskName });
    }

    const task = taskMap.get(taskId)!;
    task.hours += entry.minutes / 60;
    task.entries += 1;
  });

  // Prepare data for JSON output
  const timeEntriesData = allEntries.map(entry => ({
    id: entry.id,
    date: entry.date,
    taskName: entry.task?.name || 'No Task',
    projectName: kiroProject.name,
    hours: parseFloat((entry.minutes / 60).toFixed(2)),
    description: entry.description || ''
  }));

  const jsonOutput = {
    summary: {
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalEntries: allEntries.length,
      totalTasks: taskMap.size,
      period: `${startDateStr} to ${endDateStr}`,
      project: kiroProject.name
    },
    timeEntries: timeEntriesData
  };

  // Output raw JSON
  console.log('\n' + '='.repeat(80));
  console.log('RAW DATA (JSON):');
  console.log('='.repeat(80));
  console.log(JSON.stringify(jsonOutput, null, 2));
  console.log('='.repeat(80) + '\n');

  // Human-readable summary
  console.log('SUMMARY:');
  console.log(`Total Hours Logged: ${totalHours.toFixed(2)} hours`);
  console.log(`Total Time Entries: ${allEntries.length}`);
  console.log(`Unique Tasks: ${taskMap.size}`);
  console.log(`Project: ${kiroProject.name}`);
  console.log(`Period: ${startDateStr} to ${endDateStr}`);

  console.log('\nBREAKDOWN BY TASK:');
  const sortedTasks = Array.from(taskMap.entries())
    .sort((a, b) => b[1].hours - a[1].hours);

  sortedTasks.forEach(([taskId, data]) => {
    console.log(`  ${data.taskName}: ${data.hours.toFixed(2)}h (${data.entries} entries)`);
  });
}

main().catch(console.error);
