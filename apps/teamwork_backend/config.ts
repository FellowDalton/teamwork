// config.ts
// Configuration getters - use functions to read env AFTER loading

export const getPort = () => parseInt(process.env.PORT || "3051");
export const getTeamworkApiUrl = () => process.env.TEAMWORK_API_URL;
export const getTeamworkBearerToken = () => process.env.TEAMWORK_BEARER_TOKEN;
export const getDefaultProjectId = () => parseInt(process.env.TEAMWORK_PROJECT_ID || "0");

// Allowed project IDs
export const ALLOWED_PROJECTS = [
  { id: 805682, name: "AI workflow test" },
  { id: 804926, name: "KiroViden - Klyngeplatform" },
];
