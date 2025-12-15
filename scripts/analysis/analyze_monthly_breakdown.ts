import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getTimeEntriesWithDates() {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    tools: [
      {
        name: "mcp__teamwork__get_time_entries",
        description: "Fetch time entries for a date range",
        input_schema: {
          type: "object",
          properties: {
            startDate: { type: "string" },
            endDate: { type: "string" },
            projectId: { type: "string" },
          },
          required: ["startDate", "endDate"],
        },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          "Get all time entries from 2024-06-08 to 2025-12-08 with full details including dates",
      },
    ],
  });

  return response;
}

async function analyzeMonthlyBreakdown() {
  console.log("Fetching time entries...\n");

  const response = await getTimeEntriesWithDates();

  // Parse the response to extract time entry data
  console.log("Response:", JSON.stringify(response, null, 2));
}

analyzeMonthlyBreakdown();
