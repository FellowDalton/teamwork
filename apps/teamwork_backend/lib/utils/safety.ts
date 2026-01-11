// lib/utils/safety.ts
// Safety validation for agent responses

// List of blocked tool names (for validation/logging)
export const BLOCKED_WRITE_TOOLS = [
  "log_time",
  "create_project",
  "create_task",
  "update_task",
  "delete_task",
  "create_timelog",
];

// Validation helper to detect if agent is trying to use blocked operations
export function validateAgentResponse(response: string): {
  safe: boolean;
  warning?: string;
} {
  // Check for any patterns that might indicate the agent is trying to bypass safety
  const dangerPatterns = [
    /teamwork\.timeEntries\.create/i,
    /teamwork\.projects\.create/i,
    /teamwork\.tasks\.create/i,
    /\.create\s*\(/i,
    /\.update\s*\(/i,
    /\.delete\s*\(/i,
  ];

  for (const pattern of dangerPatterns) {
    if (pattern.test(response)) {
      console.warn(
        "SAFETY WARNING: Agent response contains potential write operation:",
        pattern.source
      );
      return {
        safe: false,
        warning: `Blocked potential write operation matching: ${pattern.source}`,
      };
    }
  }

  return { safe: true };
}
