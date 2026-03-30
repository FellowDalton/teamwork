/**
 * Resource exports for Microsoft 365 API client.
 */

export { OutlookResource } from './outlook.ts';
export type {
  ListMessagesOptions,
  SearchMessagesOptions,
  SendMailOptions,
  ListEventsOptions,
  CreateEventOptions,
} from './outlook.ts';

export { TeamsResource } from './teams.ts';
export type {
  ListChannelsOptions,
  ListMessagesOptions as ListTeamsMessagesOptions,
  SendMessageOptions,
  ListChatsOptions,
} from './teams.ts';

export { SharePointResource } from './sharepoint.ts';
export type {
  ListDriveItemsOptions,
  SearchFilesOptions,
  UploadFileOptions,
  ListSitesOptions,
  CreateFolderOptions,
} from './sharepoint.ts';
