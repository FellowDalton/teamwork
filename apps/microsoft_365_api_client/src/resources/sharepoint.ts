/**
 * SharePoint and OneDrive resource for Microsoft Graph API.
 * Provides operations for files, sites, and document libraries.
 */

import type { MicrosoftGraphHttpClient, ODataResponse } from '../client.ts';
import type {
  Drive,
  DriveItem,
  Site,
  List,
} from '../types.ts';

// ============================================================================
// Options Types
// ============================================================================

export interface ListDriveItemsOptions {
  /** Maximum number of items */
  top?: number;
  /** Skip N items */
  skip?: number;
  /** Filter expression */
  filter?: string;
  /** Fields to select */
  select?: string;
  /** Order by expression */
  orderBy?: string;
  /** Expand children or thumbnails */
  expand?: string;
}

export interface SearchFilesOptions {
  /** Maximum number of results */
  top?: number;
  /** Drive ID (default: user's OneDrive) */
  driveId?: string;
}

export interface UploadFileOptions {
  /** File name */
  fileName: string;
  /** File content (Buffer or string) */
  content: Buffer | string;
  /** Content type (MIME type) */
  contentType?: string;
  /** Parent folder path (default: root) */
  folderPath?: string;
  /** Drive ID (default: user's OneDrive) */
  driveId?: string;
  /** Conflict behavior */
  conflictBehavior?: 'fail' | 'replace' | 'rename';
}

export interface ListSitesOptions {
  /** Search query */
  search?: string;
  /** Maximum number of results */
  top?: number;
  /** Filter expression */
  filter?: string;
  /** Fields to select */
  select?: string;
}

export interface CreateFolderOptions {
  /** Folder name */
  name: string;
  /** Parent folder path (default: root) */
  parentPath?: string;
  /** Drive ID (default: user's OneDrive) */
  driveId?: string;
}

// ============================================================================
// SharePoint Resource
// ============================================================================

/**
 * SharePoint and OneDrive resource for file and site operations.
 */
export class SharePointResource {
  constructor(private readonly client: MicrosoftGraphHttpClient) {}

  // --------------------------------------------------------------------------
  // Drive Operations (OneDrive)
  // --------------------------------------------------------------------------

  /**
   * Get the current user's OneDrive.
   */
  async getMyDrive(): Promise<Drive> {
    return this.client.get<Drive>('/me/drive');
  }

  /**
   * List all drives available to the current user.
   */
  async listDrives(): Promise<ODataResponse<Drive>> {
    return this.client.get<ODataResponse<Drive>>('/me/drives');
  }

  /**
   * Get a specific drive by ID.
   */
  async getDrive(driveId: string): Promise<Drive> {
    return this.client.get<Drive>(`/drives/${driveId}`);
  }

  // --------------------------------------------------------------------------
  // File/Folder Operations
  // --------------------------------------------------------------------------

  /**
   * List items in the root of user's OneDrive.
   */
  async listRootItems(options?: ListDriveItemsOptions): Promise<ODataResponse<DriveItem>> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.top) params.$top = options.top;
    if (options?.skip) params.$skip = options.skip;
    if (options?.filter) params.$filter = options.filter;
    if (options?.select) params.$select = options.select;
    if (options?.orderBy) params.$orderby = options.orderBy;
    if (options?.expand) params.$expand = options.expand;

    return this.client.get<ODataResponse<DriveItem>>('/me/drive/root/children', { params });
  }

  /**
   * List items in a folder by path.
   */
  async listItemsByPath(
    folderPath: string,
    options?: ListDriveItemsOptions & { driveId?: string }
  ): Promise<ODataResponse<DriveItem>> {
    const drivePath = options?.driveId ? `/drives/${options.driveId}` : '/me/drive';
    const encodedPath = encodeURIComponent(folderPath);

    const params: Record<string, string | number | undefined> = {};
    if (options?.top) params.$top = options.top;
    if (options?.skip) params.$skip = options.skip;
    if (options?.filter) params.$filter = options.filter;
    if (options?.select) params.$select = options.select;
    if (options?.orderBy) params.$orderby = options.orderBy;

    return this.client.get<ODataResponse<DriveItem>>(
      `${drivePath}/root:/${encodedPath}:/children`,
      { params }
    );
  }

  /**
   * List items in a folder by ID.
   */
  async listItemsById(
    itemId: string,
    options?: ListDriveItemsOptions & { driveId?: string }
  ): Promise<ODataResponse<DriveItem>> {
    const drivePath = options?.driveId ? `/drives/${options.driveId}` : '/me/drive';

    const params: Record<string, string | number | undefined> = {};
    if (options?.top) params.$top = options.top;
    if (options?.skip) params.$skip = options.skip;
    if (options?.filter) params.$filter = options.filter;
    if (options?.select) params.$select = options.select;
    if (options?.orderBy) params.$orderby = options.orderBy;

    return this.client.get<ODataResponse<DriveItem>>(`${drivePath}/items/${itemId}/children`, { params });
  }

  /**
   * Get an item by path.
   */
  async getItemByPath(itemPath: string, driveId?: string): Promise<DriveItem> {
    const drivePath = driveId ? `/drives/${driveId}` : '/me/drive';
    const encodedPath = encodeURIComponent(itemPath);
    return this.client.get<DriveItem>(`${drivePath}/root:/${encodedPath}`);
  }

  /**
   * Get an item by ID.
   */
  async getItemById(itemId: string, driveId?: string): Promise<DriveItem> {
    const drivePath = driveId ? `/drives/${driveId}` : '/me/drive';
    return this.client.get<DriveItem>(`${drivePath}/items/${itemId}`);
  }

  /**
   * Search for files.
   */
  async searchFiles(query: string, options?: SearchFilesOptions): Promise<ODataResponse<DriveItem>> {
    const drivePath = options?.driveId ? `/drives/${options.driveId}` : '/me/drive';
    const encodedQuery = encodeURIComponent(query);

    const params: Record<string, number | undefined> = {};
    if (options?.top) params.$top = options.top;

    return this.client.get<ODataResponse<DriveItem>>(
      `${drivePath}/root/search(q='${encodedQuery}')`,
      { params }
    );
  }

  /**
   * Download file content.
   * Returns the download URL (use fetch to get actual content).
   */
  async getDownloadUrl(itemId: string, driveId?: string): Promise<string> {
    const item = await this.getItemById(itemId, driveId);
    const downloadUrl = item['@microsoft.graph.downloadUrl'];
    if (!downloadUrl) {
      throw new Error('Item does not have a download URL (may be a folder)');
    }
    return downloadUrl;
  }

  /**
   * Upload a small file (< 4MB).
   * For larger files, use upload sessions.
   */
  async uploadFile(options: UploadFileOptions): Promise<DriveItem> {
    const drivePath = options.driveId ? `/drives/${options.driveId}` : '/me/drive';
    const folderPath = options.folderPath ? `/${options.folderPath}` : '';
    const encodedPath = encodeURIComponent(`${folderPath}/${options.fileName}`.replace(/^\/+/, ''));

    const headers: Record<string, string> = {};
    if (options.contentType) {
      headers['Content-Type'] = options.contentType;
    }
    if (options.conflictBehavior) {
      headers['@microsoft.graph.conflictBehavior'] = options.conflictBehavior;
    }

    return this.client.put<DriveItem>(
      `${drivePath}/root:/${encodedPath}:/content`,
      options.content,
      { headers }
    );
  }

  /**
   * Create a folder.
   */
  async createFolder(options: CreateFolderOptions): Promise<DriveItem> {
    const drivePath = options.driveId ? `/drives/${options.driveId}` : '/me/drive';
    const parentPath = options.parentPath
      ? `/root:/${encodeURIComponent(options.parentPath)}:/children`
      : '/root/children';

    return this.client.post<DriveItem>(`${drivePath}${parentPath}`, {
      name: options.name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
  }

  /**
   * Delete a file or folder.
   */
  async deleteItem(itemId: string, driveId?: string): Promise<void> {
    const drivePath = driveId ? `/drives/${driveId}` : '/me/drive';
    await this.client.delete(`${drivePath}/items/${itemId}`);
  }

  /**
   * Copy a file or folder.
   */
  async copyItem(
    itemId: string,
    destinationPath: string,
    newName?: string,
    driveId?: string
  ): Promise<void> {
    const drivePath = driveId ? `/drives/${driveId}` : '/me/drive';

    // Get the destination folder
    const destFolder = await this.getItemByPath(destinationPath, driveId);

    await this.client.post(`${drivePath}/items/${itemId}/copy`, {
      parentReference: {
        driveId: driveId || undefined,
        id: destFolder.id,
      },
      name: newName,
    });
  }

  /**
   * Move a file or folder.
   */
  async moveItem(
    itemId: string,
    destinationPath: string,
    newName?: string,
    driveId?: string
  ): Promise<DriveItem> {
    const drivePath = driveId ? `/drives/${driveId}` : '/me/drive';

    // Get the destination folder
    const destFolder = await this.getItemByPath(destinationPath, driveId);

    const body: Record<string, unknown> = {
      parentReference: {
        id: destFolder.id,
      },
    };

    if (newName) {
      body.name = newName;
    }

    return this.client.patch<DriveItem>(`${drivePath}/items/${itemId}`, body);
  }

  // --------------------------------------------------------------------------
  // SharePoint Site Operations
  // --------------------------------------------------------------------------

  /**
   * Get the root SharePoint site.
   */
  async getRootSite(): Promise<Site> {
    return this.client.get<Site>('/sites/root');
  }

  /**
   * Get a site by path (e.g., "contoso.sharepoint.com:/sites/marketing").
   */
  async getSiteByPath(sitePath: string): Promise<Site> {
    return this.client.get<Site>(`/sites/${sitePath}`);
  }

  /**
   * Get a site by ID.
   */
  async getSiteById(siteId: string): Promise<Site> {
    return this.client.get<Site>(`/sites/${siteId}`);
  }

  /**
   * Search for SharePoint sites.
   */
  async searchSites(query: string, options?: ListSitesOptions): Promise<ODataResponse<Site>> {
    const params: Record<string, string | number | undefined> = {
      search: query,
    };
    if (options?.top) params.$top = options.top;
    if (options?.filter) params.$filter = options.filter;
    if (options?.select) params.$select = options.select;

    return this.client.get<ODataResponse<Site>>('/sites', { params });
  }

  /**
   * List sites the user is following.
   */
  async listFollowedSites(): Promise<ODataResponse<Site>> {
    return this.client.get<ODataResponse<Site>>('/me/followedSites');
  }

  /**
   * Get drives (document libraries) for a site.
   */
  async listSiteDrives(siteId: string): Promise<ODataResponse<Drive>> {
    return this.client.get<ODataResponse<Drive>>(`/sites/${siteId}/drives`);
  }

  /**
   * Get the default document library for a site.
   */
  async getSiteDefaultDrive(siteId: string): Promise<Drive> {
    return this.client.get<Drive>(`/sites/${siteId}/drive`);
  }

  /**
   * List SharePoint lists for a site.
   */
  async listSiteLists(siteId: string): Promise<ODataResponse<List>> {
    return this.client.get<ODataResponse<List>>(`/sites/${siteId}/lists`);
  }

  /**
   * Get a specific SharePoint list.
   */
  async getSiteList(siteId: string, listId: string): Promise<List> {
    return this.client.get<List>(`/sites/${siteId}/lists/${listId}`);
  }

  // --------------------------------------------------------------------------
  // Cross-Service Search
  // --------------------------------------------------------------------------

  /**
   * Search across OneDrive and SharePoint using the Search API.
   * Note: Requires Files.Read.All permission.
   */
  async searchAcrossServices(
    query: string,
    options?: { top?: number; entityTypes?: ('driveItem' | 'listItem' | 'site')[] }
  ): Promise<DriveItem[]> {
    const entityTypes = options?.entityTypes || ['driveItem'];

    const response = await this.client.post<{
      value: Array<{
        hitsContainers: Array<{
          hits: Array<{
            resource: DriveItem;
          }>;
        }>;
      }>;
    }>('/search/query', {
      requests: [
        {
          entityTypes,
          query: { queryString: query },
          from: 0,
          size: options?.top || 25,
        },
      ],
    });

    // Flatten the search results
    const items: DriveItem[] = [];
    for (const container of response.value) {
      for (const hitContainer of container.hitsContainers) {
        for (const hit of hitContainer.hits) {
          items.push(hit.resource);
        }
      }
    }

    return items;
  }

  // --------------------------------------------------------------------------
  // Shared Items
  // --------------------------------------------------------------------------

  /**
   * List items shared with the current user.
   */
  async listSharedWithMe(): Promise<ODataResponse<DriveItem>> {
    return this.client.get<ODataResponse<DriveItem>>('/me/drive/sharedWithMe');
  }

  /**
   * List recent files.
   */
  async listRecentFiles(top?: number): Promise<ODataResponse<DriveItem>> {
    const params: Record<string, number | undefined> = {};
    if (top) params.$top = top;

    return this.client.get<ODataResponse<DriveItem>>('/me/drive/recent', { params });
  }
}
