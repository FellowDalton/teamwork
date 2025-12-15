import { createTeamworkClient } from '../../apps/teamwork_api_client/src/index.ts';

const client = createTeamworkClient({
  apiUrl: process.env.TEAMWORK_API_URL!,
  bearerToken: process.env.TEAMWORK_BEARER_TOKEN!,
});

// Calculate date 7 months ago
const now = new Date();
const sevenMonthsAgo = new Date(now);
sevenMonthsAgo.setMonth(now.getMonth() - 7);

const startDate = sevenMonthsAgo.toISOString().split('T')[0];
const endDate = now.toISOString().split('T')[0];

console.log(`Fetching time entries from ${startDate} to ${endDate}...`);

// Fetch time entries for the authenticated user
const response = await client.http.get(
  `/projects/api/v3/time.json`,
  {
    params: {
      fromDate: startDate,
      toDate: endDate,
      pageSize: 500, // Get more entries per page
    }
  }
);

let totalMinutes = 0;
let totalHours = 0;
let entryCount = 0;

if (response.timelogs && Array.isArray(response.timelogs)) {
  for (const entry of response.timelogs) {
    const minutes = (entry.minutes || 0) + ((entry.hours || 0) * 60);
    totalMinutes += minutes;
    entryCount++;
  }

  // Check if there are more pages
  if (response.meta && response.meta.page) {
    const totalPages = response.meta.page.totalPages || 1;
    console.log(`Processing page 1 of ${totalPages}...`);

    // Fetch remaining pages if needed
    for (let page = 2; page <= totalPages; page++) {
      console.log(`Processing page ${page} of ${totalPages}...`);
      const pageResponse = await client.http.get(
        `/projects/api/v3/time.json`,
        {
          params: {
            fromDate: startDate,
            toDate: endDate,
            pageSize: 500,
            page: page,
          }
        }
      );

      if (pageResponse.timelogs && Array.isArray(pageResponse.timelogs)) {
        for (const entry of pageResponse.timelogs) {
          const minutes = (entry.minutes || 0) + ((entry.hours || 0) * 60);
          totalMinutes += minutes;
          entryCount++;
        }
      }
    }
  }
}

totalHours = totalMinutes / 60;

console.log('\n=== TIME LOG SUMMARY ===');
console.log(`Period: ${startDate} to ${endDate}`);
console.log(`Total entries: ${entryCount}`);
console.log(`Total hours: ${totalHours.toFixed(2)}`);
console.log(`Total time: ${Math.floor(totalHours)}h ${totalMinutes % 60}m`);
