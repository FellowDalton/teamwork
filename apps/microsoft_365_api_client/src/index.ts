/**
 * Microsoft 365 API Client
 *
 * TypeScript client for Microsoft Graph API providing access to:
 * - Outlook (Mail, Calendar)
 * - Microsoft Teams (Teams, Channels, Chats, Messages)
 * - SharePoint/OneDrive (Files, Sites, Document Libraries)
 *
 * @example
 * ```typescript
 * import { createMicrosoftClient, createMicrosoftClientFromEnv } from '@teamwork/microsoft-365-api-client';
 *
 * // From environment variables
 * const client = createMicrosoftClientFromEnv();
 *
 * // Or with explicit config
 * const client = createMicrosoftClient({
 *   tenantId: 'your-tenant-id',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 * });
 *
 * // Use resources
 * const messages = await client.outlook.listMessages({ folder: 'inbox', top: 10 });
 * const teams = await client.teams.listJoinedTeams();
 * const files = await client.sharepoint.searchFiles('quarterly report');
 *
 * // Collate context for a topic
 * const context = await client.collator.collateContext('Project Alpha');
 * console.log(client.collator.formatAsMarkdown(context));
 * ```
 */

// Auth exports
export { TokenManager, createTokenManagerFromEnv } from './auth.ts';
export type { AuthConfig, TokenInfo, TokenResponse } from './auth.ts';

// Client exports
export {
  MicrosoftGraphHttpClient,
  createHttpClientFromEnv,
} from './client.ts';
export type {
  GraphClientConfig,
  RequestOptions,
  ApiError,
  ODataResponse,
} from './client.ts';

// Resource exports
export { OutlookResource } from './resources/outlook.ts';
export { TeamsResource } from './resources/teams.ts';
export { SharePointResource } from './resources/sharepoint.ts';

// Context collator
export { ContextCollator } from './context-collator.ts';
export type { CollatedContext, CollateOptions } from './context-collator.ts';

// Type exports
export * from './types.ts';

// Resource option types
export type {
  ListMessagesOptions,
  SearchMessagesOptions,
  SendMailOptions,
  ListEventsOptions,
  CreateEventOptions,
} from './resources/outlook.ts';

export type {
  ListChannelsOptions,
  SendMessageOptions,
  ListChatsOptions,
} from './resources/teams.ts';

export type {
  ListDriveItemsOptions,
  SearchFilesOptions,
  UploadFileOptions,
  ListSitesOptions,
  CreateFolderOptions,
} from './resources/sharepoint.ts';

// Import for client factory
import { MicrosoftGraphHttpClient, type GraphClientConfig } from './client.ts';
import { OutlookResource } from './resources/outlook.ts';
import { TeamsResource } from './resources/teams.ts';
import { SharePointResource } from './resources/sharepoint.ts';
import { ContextCollator } from './context-collator.ts';

/**
 * Full Microsoft 365 client with all resources.
 */
export interface MicrosoftGraphClient {
  /** HTTP client for raw API access */
  http: MicrosoftGraphHttpClient;
  /** Outlook mail and calendar operations */
  outlook: OutlookResource;
  /** Microsoft Teams operations */
  teams: TeamsResource;
  /** SharePoint and OneDrive operations */
  sharepoint: SharePointResource;
  /** Context collator for gathering info across services */
  collator: ContextCollator;
}

/**
 * Create a Microsoft 365 client with all resources.
 *
 * @param config - Client configuration
 * @returns Fully configured client with all resources
 *
 * @example
 * ```typescript
 * const client = createMicrosoftClient({
 *   tenantId: 'your-tenant-id',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 * });
 *
 * const emails = await client.outlook.listMessages({ top: 10 });
 * ```
 */
export function createMicrosoftClient(config: GraphClientConfig): MicrosoftGraphClient {
  const http = new MicrosoftGraphHttpClient(config);
  const outlook = new OutlookResource(http);
  const teams = new TeamsResource(http);
  const sharepoint = new SharePointResource(http);

  const client: MicrosoftGraphClient = {
    http,
    outlook,
    teams,
    sharepoint,
    collator: null as unknown as ContextCollator, // Will be set below
  };

  // Create collator with reference to full client
  client.collator = new ContextCollator(client);

  return client;
}

/**
 * Create a Microsoft 365 client from environment variables.
 *
 * Required environment variables:
 * - MICROSOFT_TENANT_ID: Azure tenant ID
 * - MICROSOFT_CLIENT_ID: Application (client) ID
 * - MICROSOFT_CLIENT_SECRET: Client secret (or MICROSOFT_ACCESS_TOKEN for delegated auth)
 *
 * Optional environment variables:
 * - MICROSOFT_ACCESS_TOKEN: Pre-obtained access token (for delegated auth)
 * - MICROSOFT_USE_BETA: Use beta API (default: false)
 *
 * @param debug - Enable debug logging
 * @returns Fully configured client with all resources
 *
 * @example
 * ```typescript
 * // Set environment variables first
 * // MICROSOFT_TENANT_ID=xxx
 * // MICROSOFT_CLIENT_ID=xxx
 * // MICROSOFT_CLIENT_SECRET=xxx
 *
 * const client = createMicrosoftClientFromEnv();
 * const teams = await client.teams.listJoinedTeams();
 * ```
 */
export function createMicrosoftClientFromEnv(debug?: boolean): MicrosoftGraphClient {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const accessToken = process.env.MICROSOFT_ACCESS_TOKEN;
  const useBeta = process.env.MICROSOFT_USE_BETA === 'true';

  if (!tenantId) {
    throw new Error('MICROSOFT_TENANT_ID environment variable is required');
  }

  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID environment variable is required');
  }

  if (!clientSecret && !accessToken) {
    throw new Error('Either MICROSOFT_CLIENT_SECRET or MICROSOFT_ACCESS_TOKEN is required');
  }

  return createMicrosoftClient({
    tenantId,
    clientId,
    clientSecret,
    accessToken,
    useBeta,
    debug,
  });
}
