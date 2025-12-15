#!/usr/bin/env bun

/**
 * Export monthly time entry data to CSV format
 */

import { createTeamworkClient } from '../../apps/teamwork_api_client/src/index.ts';
import { writeFile } from 'fs/promises';

interface MonthlyRecord {
  month: string;
  year: number;
  monthNum: number;
  totalHours: number;
  entryCount: number;
  avgHoursPerEntry: number;
  topTask: string;
  topTaskHours: number;
}

async function exportToCSV() {
  const client = createTeamworkClient({
    apiUrl: process.env.TEAMWORK_API_URL || process.env.TW_MCP_API_URL!,
    bearerToken: process.env.TEAMWORK_BEARER_TOKEN || process.env.TW_MCP_BEARER_TOKEN!,
    debug: false,
  });

  console.log('Fetching time entries...');

  // Fetch all entries
  let allEntries: any[] = [];
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
    hasMore = response.meta?.page?.hasMore ?? false;
    page++;
  }

  console.log(`Fetched ${allEntries.length} entries`);

  // Group by month
  const monthlyData = new Map<string, {
    totalHours: number;
    entryCount: number;
    tasks: Map<string, number>;
  }>();

  for (const entry of allEntries) {
    const dateStr = entry.timeLogged || entry.date;
    if (!dateStr) continue;

    const monthKey = dateStr.substring(0, 7);

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        totalHours: 0,
        entryCount: 0,
        tasks: new Map(),
      });
    }

    const data = monthlyData.get(monthKey)!;
    const hours = entry.minutes / 60;

    data.totalHours += hours;
    data.entryCount += 1;

    const taskName = entry.taskId ? `Task ${entry.taskId}` : 'Unknown';
    data.tasks.set(taskName, (data.tasks.get(taskName) || 0) + hours);
  }

  // Convert to records
  const records: MonthlyRecord[] = [];

  for (const [monthKey, data] of Array.from(monthlyData.entries()).sort()) {
    const [year, month] = monthKey.split('-').map(Number);
    const topTaskEntry = Array.from(data.tasks.entries())
      .sort((a, b) => b[1] - a[1])[0];

    records.push({
      month: monthKey,
      year,
      monthNum: month,
      totalHours: Math.round(data.totalHours * 100) / 100,
      entryCount: data.entryCount,
      avgHoursPerEntry: Math.round((data.totalHours / data.entryCount) * 100) / 100,
      topTask: topTaskEntry?.[0] || 'None',
      topTaskHours: Math.round((topTaskEntry?.[1] || 0) * 100) / 100,
    });
  }

  // Create CSV
  const headers = Object.keys(records[0]);
  const csvLines = [
    headers.join(','),
    ...records.map(r =>
      headers.map(h => {
        const value = r[h as keyof MonthlyRecord];
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      }).join(',')
    )
  ];

  const csvContent = csvLines.join('\n');

  // Write to file
  await writeFile('monthly_time_entries.csv', csvContent);
  console.log('\nCSV exported to: monthly_time_entries.csv');
  console.log(`Total records: ${records.length}`);
}

exportToCSV().catch(console.error);
