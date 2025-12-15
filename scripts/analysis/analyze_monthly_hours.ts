#!/usr/bin/env bun

/**
 * Monthly Time Entry Analysis Script
 *
 * Fetches time entries from Teamwork API and analyzes them by month,
 * providing:
 * - Total hours per month
 * - Number of entries per month
 * - Most common tasks worked on each month
 */

import { createTeamworkClient } from '../../apps/teamwork_api_client/src/index.ts';

interface MonthlyStats {
  month: string; // YYYY-MM format
  totalHours: number;
  entryCount: number;
  tasks: Map<string, { count: number; hours: number }>;
}

async function analyzeMonthlyBreakdown() {
  // Initialize client from environment
  const client = createTeamworkClient({
    apiUrl: process.env.TEAMWORK_API_URL || process.env.TW_MCP_API_URL!,
    bearerToken: process.env.TEAMWORK_BEARER_TOKEN || process.env.TW_MCP_BEARER_TOKEN!,
    debug: false,
  });

  console.log('Fetching time entries from 2024-06-08 to 2025-12-08...\n');

  // Fetch all time entries (handle pagination)
  let allEntries: any[] = [];
  let includedTasks: any = {};
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.timeEntries.list({
      startDate: '2024-06-08',
      endDate: '2025-12-08',
      pageSize: 250,
      page: page,
      include: ['tasks'],
    });

    allEntries = allEntries.concat(response.timelogs);

    // Merge included tasks
    if (response.included?.tasks) {
      includedTasks = { ...includedTasks, ...response.included.tasks };
    }

    // Check if there are more pages
    hasMore = response.meta?.page?.hasMore ?? false;
    page++;

    if (hasMore) {
      console.log(`Fetched page ${page - 1} (${response.timelogs.length} entries)...`);
    }
  }

  console.log(`\nTotal entries fetched: ${allEntries.length}\n`);

  // Group entries by month
  const monthlyData = new Map<string, MonthlyStats>();

  for (const entry of allEntries) {
    // Use timeLogged field (ISO timestamp) or date field
    const dateStr = entry.timeLogged || entry.date;
    if (!dateStr) {
      continue;
    }

    // Extract YYYY-MM from date (handle both ISO timestamp and date string)
    const monthKey = dateStr.substring(0, 7); // '2024-12' format

    // Initialize month if doesn't exist
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        month: monthKey,
        totalHours: 0,
        entryCount: 0,
        tasks: new Map(),
      });
    }

    const monthStats = monthlyData.get(monthKey)!;

    // Add hours (convert minutes to hours)
    const hours = entry.minutes / 60;
    monthStats.totalHours += hours;
    monthStats.entryCount += 1;

    // Track task information
    const taskId = entry.taskId?.toString() || 'No Task';
    const taskName = getTaskName(entry.taskId, includedTasks) || 'Unknown Task';
    const taskKey = `${taskId}:${taskName}`;

    if (!monthStats.tasks.has(taskKey)) {
      monthStats.tasks.set(taskKey, { count: 0, hours: 0 });
    }

    const taskStats = monthStats.tasks.get(taskKey)!;
    taskStats.count += 1;
    taskStats.hours += hours;
  }

  // Sort months chronologically
  const sortedMonths = Array.from(monthlyData.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // Display results
  console.log('=' .repeat(80));
  console.log('MONTHLY TIME ENTRY BREAKDOWN');
  console.log('='.repeat(80));
  console.log();

  let grandTotalHours = 0;
  let grandTotalEntries = 0;

  for (const monthStats of sortedMonths) {
    grandTotalHours += monthStats.totalHours;
    grandTotalEntries += monthStats.entryCount;

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Month: ${formatMonth(monthStats.month)}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`Total Hours: ${monthStats.totalHours.toFixed(2)} hours`);
    console.log(`Number of Entries: ${monthStats.entryCount}`);
    console.log(`Average Hours per Entry: ${(monthStats.totalHours / monthStats.entryCount).toFixed(2)} hours`);

    // Get top 5 tasks by hours
    const topTasks = Array.from(monthStats.tasks.entries())
      .sort((a, b) => b[1].hours - a[1].hours)
      .slice(0, 5);

    console.log(`\nTop Tasks (by hours):`);
    for (let i = 0; i < topTasks.length; i++) {
      const [taskKey, stats] = topTasks[i];
      const [taskId, taskName] = taskKey.split(':');
      console.log(`  ${i + 1}. ${taskName} (ID: ${taskId})`);
      console.log(`     ${stats.hours.toFixed(2)} hours across ${stats.count} entries`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Time Period: 2024-06-08 to 2025-12-08`);
  console.log(`Total Months: ${sortedMonths.length}`);
  console.log(`Total Hours: ${grandTotalHours.toFixed(2)} hours`);
  console.log(`Total Entries: ${grandTotalEntries}`);
  console.log(`Average Hours per Month: ${(grandTotalHours / sortedMonths.length).toFixed(2)} hours`);
  console.log(`Average Entries per Month: ${(grandTotalEntries / sortedMonths.length).toFixed(0)} entries`);
  console.log('='.repeat(80));
}

/**
 * Get task name from included data
 */
function getTaskName(
  taskId: number | null | undefined,
  tasksData: Record<string, any> | undefined
): string | null {
  if (!taskId || !tasksData) return null;

  const task = tasksData[taskId.toString()];
  return task?.name || null;
}

/**
 * Format month string for display
 */
function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Run the analysis
analyzeMonthlyBreakdown().catch((error) => {
  console.error('Error analyzing time entries:', error);
  process.exit(1);
});
