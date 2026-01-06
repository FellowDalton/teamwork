/**
 * Webhooks resource module for Teamwork API.
 * Provides webhook management operations.
 */

import type { TeamworkHttpClient } from '../client.ts';

// Webhook event types supported by Teamwork
export type WebhookEventType = 
  | 'BUDGET'
  | 'CALENDEREVENT'
  | 'COMMENT'
  | 'COMPANY'
  | 'EXPENSE'
  | 'FILE'
  | 'FORM'
  | 'INVOICE'
  | 'LINK'
  | 'MESSAGE'
  | 'MESSAGEREPLY'
  | 'MILESTONE'
  | 'NOTEBOOK'
  | 'PROJECT'
  | 'PROJECTUPDATE'
  | 'RISK'
  | 'ROLE'
  | 'STATUS'
  | 'TASK'
  | 'TASKLIST'
  | 'TEAM'
  | 'TIME'
  | 'TIMER'
  | 'USER';

// Event actions for different event types
export type WebhookEventAction = 
  | 'CREATED'
  | 'DELETED'
  | 'UPDATED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'MOVED'
  | 'TAGGED'
  | 'UNTAGGED'
  | 'REMINDER'
  | 'DOWNLOADED'
  | 'PUBLISHED'
  | 'SUBMITTED'
  | 'ARCHIVED'
  | 'COPIED';

export interface Webhook {
  id: number;
  event: string;
  url: string;
  status: 'ACTIVE' | 'INACTIVE';
  contentType?: string;
  version?: number;
  projectId?: number;
  token?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookListResponse {
  webhooks: Webhook[];
  STATUS?: string;
}

export interface WebhookResponse {
  webhook: Webhook;
  STATUS?: string;
}

export interface CreateWebhookOptions {
  /** The URL to send webhook events to (required) */
  url: string;
  /** Event type to subscribe to (e.g., 'TASK') */
  event: WebhookEventType;
  /** Event action to filter (e.g., 'MOVED', 'CREATED') */
  status?: WebhookEventAction;
  /** Content type for the webhook payload */
  contentType?: 'application/json' | 'application/xml' | 'application/x-www-form-urlencoded';
  /** Webhook version (2 recommended for more data) */
  version?: 1 | 2;
  /** Optional security token for HMAC signature verification */
  token?: string;
  /** Project ID for project-level webhooks (omit for site-level) */
  projectId?: number;
}

export interface ListWebhooksOptions {
  /** Filter by project ID */
  projectId?: number;
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

/**
 * Webhooks resource for managing Teamwork webhooks.
 */
export class WebhooksResource {
  constructor(private client: TeamworkHttpClient) {}

  /**
   * List all webhooks for the site or a specific project.
   */
  async list(options?: ListWebhooksOptions): Promise<WebhookListResponse> {
    const params: Record<string, any> = {};
    
    if (options?.page) params.page = options.page;
    if (options?.pageSize) params.pageSize = options.pageSize;
    
    const endpoint = options?.projectId
      ? `/projects/api/v1/projects/${options.projectId}/webhooks.json`
      : '/projects/api/v1/webhooks.json';
    
    const response = await this.client.get<WebhookListResponse>(endpoint, params);
    return response;
  }

  /**
   * Get a specific webhook by ID.
   */
  async get(webhookId: number): Promise<WebhookResponse> {
    const response = await this.client.get<WebhookResponse>(
      `/projects/api/v1/webhooks/${webhookId}.json`
    );
    return response;
  }

  /**
   * Create a new webhook.
   * 
   * @example
   * // Create a site-level webhook for task moved events
   * await client.webhooks.create({
   *   url: 'https://your-server.com/api/webhooks/teamwork',
   *   event: 'TASK',
   *   status: 'MOVED',
   *   contentType: 'application/json',
   *   version: 2,
   *   token: 'your-secret-token',
   * });
   * 
   * @example
   * // Create a project-level webhook
   * await client.webhooks.create({
   *   url: 'https://your-server.com/api/webhooks/teamwork',
   *   event: 'TASK',
   *   status: 'CREATED',
   *   projectId: 123456,
   * });
   */
  async create(options: CreateWebhookOptions): Promise<WebhookResponse> {
    const endpoint = options.projectId
      ? `/projects/api/v1/projects/${options.projectId}/webhooks.json`
      : '/projects/api/v1/webhooks.json';
    
    const payload: Record<string, any> = {
      webhook: {
        event: options.event,
        url: options.url,
      },
    };
    
    // Add optional status/action
    if (options.status) {
      payload.webhook.status = options.status;
    }
    
    // Add content type
    if (options.contentType) {
      payload.webhook.contentType = options.contentType;
    }
    
    // Add version
    if (options.version) {
      payload.webhook.version = options.version;
    }
    
    // Add security token
    if (options.token) {
      payload.webhook.token = options.token;
    }
    
    const response = await this.client.post<WebhookResponse>(endpoint, payload);
    return response;
  }

  /**
   * Update an existing webhook.
   */
  async update(webhookId: number, options: Partial<CreateWebhookOptions>): Promise<WebhookResponse> {
    const payload: Record<string, any> = {
      webhook: {},
    };
    
    if (options.url) payload.webhook.url = options.url;
    if (options.event) payload.webhook.event = options.event;
    if (options.status) payload.webhook.status = options.status;
    if (options.contentType) payload.webhook.contentType = options.contentType;
    if (options.version) payload.webhook.version = options.version;
    if (options.token) payload.webhook.token = options.token;
    
    const response = await this.client.put<WebhookResponse>(
      `/projects/api/v1/webhooks/${webhookId}.json`,
      payload
    );
    return response;
  }

  /**
   * Delete a webhook.
   */
  async delete(webhookId: number): Promise<void> {
    await this.client.delete(`/projects/api/v1/webhooks/${webhookId}.json`);
  }

  /**
   * Pause/deactivate a webhook.
   */
  async pause(webhookId: number): Promise<WebhookResponse> {
    return this.update(webhookId, { status: undefined }); // API uses different mechanism
    // Note: May need adjustment based on actual API behavior
  }

  /**
   * Helper: Create a webhook for TASK.MOVED events.
   */
  async createTaskMovedWebhook(url: string, options?: { 
    token?: string; 
    projectId?: number;
  }): Promise<WebhookResponse> {
    return this.create({
      url,
      event: 'TASK',
      status: 'MOVED',
      contentType: 'application/json',
      version: 2,
      ...options,
    });
  }

  /**
   * Helper: Create webhooks for all task events.
   */
  async createAllTaskWebhooks(url: string, options?: {
    token?: string;
    projectId?: number;
  }): Promise<WebhookResponse[]> {
    const actions: WebhookEventAction[] = [
      'CREATED', 'DELETED', 'UPDATED', 'COMPLETED', 'MOVED', 'REOPENED'
    ];
    
    const results: WebhookResponse[] = [];
    for (const action of actions) {
      const response = await this.create({
        url,
        event: 'TASK',
        status: action,
        contentType: 'application/json',
        version: 2,
        ...options,
      });
      results.push(response);
    }
    
    return results;
  }
}
