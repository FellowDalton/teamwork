/**
 * Microsoft Teams resource for Microsoft Graph API.
 * Provides operations for teams, channels, chats, and messages.
 */

import type { MicrosoftGraphHttpClient, ODataResponse } from '../client.ts';
import type {
  Team,
  Channel,
  ChatMessage,
  Chat,
  ItemBody,
} from '../types.ts';

// ============================================================================
// Options Types
// ============================================================================

export interface ListChannelsOptions {
  /** Filter expression */
  filter?: string;
  /** Fields to select */
  select?: string;
}

export interface ListMessagesOptions {
  /** Maximum number of messages */
  top?: number;
  /** Order by expression */
  orderBy?: string;
}

export interface SendMessageOptions {
  /** Message content */
  content: string;
  /** Content type (default: html) */
  contentType?: 'text' | 'html';
  /** Message importance */
  importance?: 'normal' | 'high' | 'urgent';
  /** Subject (for channel messages) */
  subject?: string;
}

export interface ListChatsOptions {
  /** Maximum number of chats */
  top?: number;
  /** Filter expression */
  filter?: string;
  /** Fields to select */
  select?: string;
  /** Expand related data */
  expand?: string;
}

// ============================================================================
// Teams Resource
// ============================================================================

/**
 * Teams resource for team, channel, chat, and message operations.
 */
export class TeamsResource {
  constructor(private readonly client: MicrosoftGraphHttpClient) {}

  // --------------------------------------------------------------------------
  // Teams Operations
  // --------------------------------------------------------------------------

  /**
   * List teams the current user is a member of.
   */
  async listJoinedTeams(): Promise<ODataResponse<Team>> {
    return this.client.get<ODataResponse<Team>>('/me/joinedTeams');
  }

  /**
   * Get a specific team.
   */
  async getTeam(teamId: string): Promise<Team> {
    return this.client.get<Team>(`/teams/${teamId}`);
  }

  /**
   * Get team by group ID (teams are groups).
   */
  async getTeamByGroupId(groupId: string): Promise<Team> {
    return this.client.get<Team>(`/groups/${groupId}/team`);
  }

  // --------------------------------------------------------------------------
  // Channel Operations
  // --------------------------------------------------------------------------

  /**
   * List channels in a team.
   */
  async listChannels(teamId: string, options?: ListChannelsOptions): Promise<ODataResponse<Channel>> {
    const params: Record<string, string | undefined> = {};
    if (options?.filter) params.$filter = options.filter;
    if (options?.select) params.$select = options.select;

    return this.client.get<ODataResponse<Channel>>(`/teams/${teamId}/channels`, { params });
  }

  /**
   * Get a specific channel.
   */
  async getChannel(teamId: string, channelId: string): Promise<Channel> {
    return this.client.get<Channel>(`/teams/${teamId}/channels/${channelId}`);
  }

  /**
   * Get the primary (General) channel of a team.
   */
  async getPrimaryChannel(teamId: string): Promise<Channel> {
    return this.client.get<Channel>(`/teams/${teamId}/primaryChannel`);
  }

  /**
   * Create a new channel.
   */
  async createChannel(
    teamId: string,
    displayName: string,
    description?: string,
    membershipType: 'standard' | 'private' | 'shared' = 'standard'
  ): Promise<Channel> {
    return this.client.post<Channel>(`/teams/${teamId}/channels`, {
      displayName,
      description,
      membershipType,
    });
  }

  /**
   * Delete a channel.
   */
  async deleteChannel(teamId: string, channelId: string): Promise<void> {
    await this.client.delete(`/teams/${teamId}/channels/${channelId}`);
  }

  // --------------------------------------------------------------------------
  // Channel Message Operations
  // --------------------------------------------------------------------------

  /**
   * List messages in a channel.
   */
  async listChannelMessages(
    teamId: string,
    channelId: string,
    options?: ListMessagesOptions
  ): Promise<ODataResponse<ChatMessage>> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.top) params.$top = options.top;
    if (options?.orderBy) params.$orderby = options.orderBy;

    return this.client.get<ODataResponse<ChatMessage>>(
      `/teams/${teamId}/channels/${channelId}/messages`,
      { params }
    );
  }

  /**
   * Get a specific channel message.
   */
  async getChannelMessage(teamId: string, channelId: string, messageId: string): Promise<ChatMessage> {
    return this.client.get<ChatMessage>(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}`
    );
  }

  /**
   * List replies to a channel message.
   */
  async listMessageReplies(
    teamId: string,
    channelId: string,
    messageId: string,
    options?: ListMessagesOptions
  ): Promise<ODataResponse<ChatMessage>> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.top) params.$top = options.top;

    return this.client.get<ODataResponse<ChatMessage>>(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
      { params }
    );
  }

  /**
   * Send a message to a channel.
   */
  async sendChannelMessage(
    teamId: string,
    channelId: string,
    options: SendMessageOptions
  ): Promise<ChatMessage> {
    const body: ItemBody = {
      contentType: options.contentType || 'html',
      content: options.content,
    };

    return this.client.post<ChatMessage>(
      `/teams/${teamId}/channels/${channelId}/messages`,
      {
        body,
        importance: options.importance,
        subject: options.subject,
      }
    );
  }

  /**
   * Reply to a channel message.
   */
  async replyToChannelMessage(
    teamId: string,
    channelId: string,
    messageId: string,
    options: SendMessageOptions
  ): Promise<ChatMessage> {
    const body: ItemBody = {
      contentType: options.contentType || 'html',
      content: options.content,
    };

    return this.client.post<ChatMessage>(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
      {
        body,
        importance: options.importance,
      }
    );
  }

  // --------------------------------------------------------------------------
  // Chat Operations
  // --------------------------------------------------------------------------

  /**
   * List chats the current user is a member of.
   */
  async listChats(options?: ListChatsOptions): Promise<ODataResponse<Chat>> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.top) params.$top = options.top;
    if (options?.filter) params.$filter = options.filter;
    if (options?.select) params.$select = options.select;
    if (options?.expand) params.$expand = options.expand;

    return this.client.get<ODataResponse<Chat>>('/me/chats', { params });
  }

  /**
   * Get a specific chat.
   */
  async getChat(chatId: string): Promise<Chat> {
    return this.client.get<Chat>(`/chats/${chatId}`);
  }

  /**
   * List messages in a chat.
   */
  async listChatMessages(chatId: string, options?: ListMessagesOptions): Promise<ODataResponse<ChatMessage>> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.top) params.$top = options.top;
    if (options?.orderBy) params.$orderby = options.orderBy;

    return this.client.get<ODataResponse<ChatMessage>>(`/chats/${chatId}/messages`, { params });
  }

  /**
   * Get a specific chat message.
   */
  async getChatMessage(chatId: string, messageId: string): Promise<ChatMessage> {
    return this.client.get<ChatMessage>(`/chats/${chatId}/messages/${messageId}`);
  }

  /**
   * Send a message to a chat.
   */
  async sendChatMessage(chatId: string, options: SendMessageOptions): Promise<ChatMessage> {
    const body: ItemBody = {
      contentType: options.contentType || 'html',
      content: options.content,
    };

    return this.client.post<ChatMessage>(`/chats/${chatId}/messages`, {
      body,
      importance: options.importance,
    });
  }

  // --------------------------------------------------------------------------
  // Search Operations
  // --------------------------------------------------------------------------

  /**
   * Search across all channels and chats.
   * Note: Requires Search.Read permission.
   */
  async searchMessages(query: string, top: number = 25): Promise<ODataResponse<ChatMessage>> {
    // Use the search API for cross-team/chat search
    const response = await this.client.post<{
      value: Array<{
        hitsContainers: Array<{
          hits: Array<{
            resource: ChatMessage;
          }>;
        }>;
      }>;
    }>('/search/query', {
      requests: [
        {
          entityTypes: ['chatMessage'],
          query: { queryString: query },
          from: 0,
          size: top,
        },
      ],
    });

    // Flatten the search results
    const messages: ChatMessage[] = [];
    for (const container of response.value) {
      for (const hitContainer of container.hitsContainers) {
        for (const hit of hitContainer.hits) {
          messages.push(hit.resource);
        }
      }
    }

    return { value: messages };
  }

  // --------------------------------------------------------------------------
  // Meeting Operations
  // --------------------------------------------------------------------------

  /**
   * Get online meeting details (if event has Teams meeting).
   * Note: Requires OnlineMeetings.Read permission.
   */
  async getOnlineMeeting(meetingId: string): Promise<{
    id: string;
    subject: string;
    joinWebUrl: string;
    startDateTime: string;
    endDateTime: string;
  }> {
    return this.client.get(`/me/onlineMeetings/${meetingId}`);
  }

  /**
   * Create an online meeting.
   */
  async createOnlineMeeting(options: {
    subject: string;
    startDateTime: string;
    endDateTime: string;
    participants?: string[];
  }): Promise<{
    id: string;
    subject: string;
    joinWebUrl: string;
    startDateTime: string;
    endDateTime: string;
  }> {
    return this.client.post('/me/onlineMeetings', {
      subject: options.subject,
      startDateTime: options.startDateTime,
      endDateTime: options.endDateTime,
      participants: options.participants
        ? {
            attendees: options.participants.map((email) => ({
              upn: email,
              role: 'attendee',
            })),
          }
        : undefined,
    });
  }
}
