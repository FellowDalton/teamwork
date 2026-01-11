// lib/mcp/index.ts
// MCP server factory for Teamwork tools

import type { TeamworkClient } from "../teamwork_api_client/index.ts";
import { createTeamworkTools } from "./tools.ts";

export function createTeamworkMcpServer(
  teamwork: TeamworkClient,
  createSdkMcpServer: any,
  tool: any,
  ALLOWED_PROJECTS: Array<{ id: number; name: string }>
) {
  const tools = createTeamworkTools(teamwork, tool, ALLOWED_PROJECTS);

  return createSdkMcpServer({
    name: "teamwork",
    tools,
  });
}

export type TeamworkMcpServer = ReturnType<typeof createTeamworkMcpServer>;
