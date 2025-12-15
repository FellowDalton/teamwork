#!/usr/bin/env bun

/**
 * Create ASCII chart visualization of monthly time entries
 */

import { readFile } from 'fs/promises';

interface MonthRecord {
  month: string;
  year: number;
  monthNum: number;
  totalHours: number;
  entryCount: number;
  avgHoursPerEntry: number;
  topTask: string;
  topTaskHours: number;
}

async function visualizeData() {
  // Read CSV
  const csvContent = await readFile('monthly_time_entries.csv', 'utf-8');
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');

  const records: MonthRecord[] = lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      month: values[0],
      year: parseInt(values[1]),
      monthNum: parseInt(values[2]),
      totalHours: parseFloat(values[3]),
      entryCount: parseInt(values[4]),
      avgHoursPerEntry: parseFloat(values[5]),
      topTask: values[6],
      topTaskHours: parseFloat(values[7]),
    };
  });

  console.log('\n' + '='.repeat(80));
  console.log('MONTHLY TIME ENTRY VISUALIZATION');
  console.log('='.repeat(80) + '\n');

  // Chart 1: Total Hours per Month
  console.log('Total Hours per Month (Bar Chart)');
  console.log('-'.repeat(80));

  const maxHours = Math.max(...records.map(r => r.totalHours));
  const scale = 60 / maxHours; // Scale to fit 60 characters

  for (const record of records) {
    const monthName = formatMonth(record.month);
    const barLength = Math.round(record.totalHours * scale);
    const bar = '█'.repeat(barLength);
    console.log(`${monthName.padEnd(12)} │${bar} ${record.totalHours.toFixed(2)}h`);
  }

  console.log();

  // Chart 2: Entry Count per Month
  console.log('\nEntry Count per Month (Bar Chart)');
  console.log('-'.repeat(80));

  const maxEntries = Math.max(...records.map(r => r.entryCount));
  const entryScale = 60 / maxEntries;

  for (const record of records) {
    const monthName = formatMonth(record.month);
    const barLength = Math.round(record.entryCount * entryScale);
    const bar = '▓'.repeat(barLength);
    console.log(`${monthName.padEnd(12)} │${bar} ${record.entryCount} entries`);
  }

  console.log();

  // Chart 3: Average Hours per Entry Trend
  console.log('\nAverage Hours per Entry (Line Chart)');
  console.log('-'.repeat(80));

  const maxAvg = Math.max(...records.map(r => r.avgHoursPerEntry));
  const avgScale = 60 / maxAvg;

  for (const record of records) {
    const monthName = formatMonth(record.month);
    const dotPosition = Math.round(record.avgHoursPerEntry * avgScale);
    const line = ' '.repeat(dotPosition) + '●';
    console.log(`${monthName.padEnd(12)} │${line} ${record.avgHoursPerEntry.toFixed(2)}h/entry`);
  }

  console.log();

  // Summary Statistics
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));

  const totalHours = records.reduce((sum, r) => sum + r.totalHours, 0);
  const totalEntries = records.reduce((sum, r) => sum + r.entryCount, 0);

  console.log(`\nTime Period: ${records[0].month} to ${records[records.length - 1].month}`);
  console.log(`Total Months: ${records.length}`);
  console.log(`Total Hours: ${totalHours.toFixed(2)} hours`);
  console.log(`Total Entries: ${totalEntries}`);
  console.log(`Average Hours/Month: ${(totalHours / records.length).toFixed(2)} hours`);
  console.log(`Average Entries/Month: ${Math.round(totalEntries / records.length)} entries`);
  console.log(`Average Hours/Entry: ${(totalHours / totalEntries).toFixed(2)} hours`);

  // Identify trends
  console.log('\n' + '-'.repeat(80));
  console.log('TRENDS');
  console.log('-'.repeat(80));

  const sortedByHours = [...records].sort((a, b) => b.totalHours - a.totalHours);
  const sortedByEntries = [...records].sort((a, b) => b.entryCount - a.entryCount);

  console.log('\nTop 3 Months by Hours:');
  sortedByHours.slice(0, 3).forEach((r, i) => {
    console.log(`  ${i + 1}. ${formatMonth(r.month)}: ${r.totalHours.toFixed(2)} hours`);
  });

  console.log('\nTop 3 Months by Entry Count:');
  sortedByEntries.slice(0, 3).forEach((r, i) => {
    console.log(`  ${i + 1}. ${formatMonth(r.month)}: ${r.entryCount} entries`);
  });

  // Year comparison
  const year2024 = records.filter(r => r.year === 2024);
  const year2025 = records.filter(r => r.year === 2025);

  const hours2024 = year2024.reduce((sum, r) => sum + r.totalHours, 0);
  const hours2025 = year2025.reduce((sum, r) => sum + r.totalHours, 0);

  console.log('\nYear Comparison:');
  console.log(`  2024: ${hours2024.toFixed(2)} hours (${year2024.length} months)`);
  console.log(`  2025: ${hours2025.toFixed(2)} hours (${year2025.length} months)`);
  console.log(`  Growth: ${((hours2025 - hours2024) / hours2024 * 100).toFixed(1)}%`);

  console.log('\n' + '='.repeat(80) + '\n');
}

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

visualizeData().catch(console.error);
