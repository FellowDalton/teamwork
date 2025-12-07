/**
 * Outlook Mail and Calendar resource for Microsoft Graph API.
 * Provides operations for reading/sending emails and managing calendar events.
 */

import type { MicrosoftGraphHttpClient, ODataResponse } from '../client.ts';
import type {
  Message,
  MailFolder,
  Attachment,
  Event,
  Calendar,
  Recipient,
  ItemBody,
  DateTimeTimeZone,
  Attendee,
} from '../types.ts';

// ============================================================================
// Options Types
// ============================================================================

export interface ListMessagesOptions {
  /** Folder to list messages from (default: inbox) */
  folder?: string | 'inbox' | 'drafts' | 'sentItems' | 'deletedItems';
  /** Maximum number of messages to return (default: 50, max: 1000) */
  top?: number;
  /** Number of messages to skip */
  skip?: number;
  /** OData filter expression */
  filter?: string;
  /** Fields to select (comma-separated) */
  select?: string;
  /** Order by expression */
  orderBy?: string;
  /** Search query (KQL) */
  search?: string;
  /** Include body content */
  includeBody?: boolean;
}

export interface SearchMessagesOptions {
  /** Maximum number of results */
  top?: number;
  /** Fields to select */
  select?: string;
}

export interface SendMailOptions {
  /** Email subject */
  subject: string;
  /** Email body content */
  body: string;
  /** Body content type (default: html) */
  contentType?: 'text' | 'html';
  /** To recipients */
  toRecipients: string[];
  /** CC recipients */
  ccRecipients?: string[];
  /** BCC recipients */
  bccRecipients?: string[];
  /** Email importance */
  importance?: 'low' | 'normal' | 'high';
  /** Save to sent items (default: true) */
  saveToSentItems?: boolean;
}

export interface ListEventsOptions {
  /** Calendar ID (default: primary calendar) */
  calendarId?: string;
  /** Start of date range (ISO 8601) */
  startDateTime?: string;
  /** End of date range (ISO 8601) */
  endDateTime?: string;
  /** Maximum number of events */
  top?: number;
  /** Number to skip */
  skip?: number;
  /** OData filter */
  filter?: string;
  /** Fields to select */
  select?: string;
  /** Order by expression */
  orderBy?: string;
}

export interface CreateEventOptions {
  /** Event subject */
  subject: string;
  /** Event body */
  body?: string;
  /** Body content type */
  contentType?: 'text' | 'html';
  /** Start time */
  start: { dateTime: string; timeZone?: string };
  /** End time */
  end: { dateTime: string; timeZone?: string };
  /** Location name */
  location?: string;
  /** Attendees (email addresses) */
  attendees?: string[];
  /** All day event */
  isAllDay?: boolean;
  /** Include Teams meeting link */
  isOnlineMeeting?: boolean;
  /** Calendar ID (default: primary) */
  calendarId?: string;
}

// ============================================================================
// Outlook Resource
// ============================================================================

/**
 * Outlook resource for mail and calendar operations.
 */
export class OutlookResource {
  constructor(private readonly client: MicrosoftGraphHttpClient) {}

  // --------------------------------------------------------------------------
  // Mail Operations
  // --------------------------------------------------------------------------

  /**
   * List messages from a mail folder.
   */
  async listMessages(options?: ListMessagesOptions): Promise<ODataResponse<Message>> {
    const folder = options?.folder || 'inbox';
    const path = folder === 'inbox' || folder === 'drafts' || folder === 'sentItems' || folder === 'deletedItems'
      ? `/me/mailfolders/${folder}/messages`
      : `/me/mailfolders/${folder}/messages`;

    const params: Record<string, string | number | boolean | undefined> = {};

    if (options?.top) params.$top = options.top;
    if (options?.skip) params.$skip = options.skip;
    if (options?.filter) params.$filter = options.filter;
    if (options?.search) params.$search = `"${options.search}"`;
    if (options?.orderBy) params.$orderby = options.orderBy;
    else params.$orderby = 'receivedDateTime desc';

    if (options?.select) {
      params.$select = options.select;
    } else if (!options?.includeBody) {
      // Exclude body by default for performance
      params.$select = 'id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments,importance';
    }

    return this.client.get<ODataResponse<Message>>(path, { params });
  }

  /**
   * Get a specific message by ID.
   */
  async getMessage(messageId: string): Promise<Message> {
    return this.client.get<Message>(`/me/messages/${messageId}`);
  }

  /**
   * Search messages using KQL query.
   */
  async searchMessages(query: string, options?: SearchMessagesOptions): Promise<ODataResponse<Message>> {
    const params: Record<string, string | number | undefined> = {
      $search: `"${query}"`,
      $orderby: 'receivedDateTime desc',
    };

    if (options?.top) params.$top = options.top;
    if (options?.select) params.$select = options.select;

    return this.client.get<ODataResponse<Message>>('/me/messages', { params });
  }

  /**
   * Send a new email.
   */
  async sendMail(options: SendMailOptions): Promise<void> {
    const toRecipients: Recipient[] = options.toRecipients.map(email => ({
      emailAddress: { address: email },
    }));

    const ccRecipients: Recipient[] | undefined = options.ccRecipients?.map(email => ({
      emailAddress: { address: email },
    }));

    const bccRecipients: Recipient[] | undefined = options.bccRecipients?.map(email => ({
      emailAddress: { address: email },
    }));

    const body: ItemBody = {
      contentType: options.contentType || 'html',
      content: options.body,
    };

    await this.client.post('/me/sendMail', {
      message: {
        subject: options.subject,
        body,
        toRecipients,
        ccRecipients,
        bccRecipients,
        importance: options.importance,
      },
      saveToSentItems: options.saveToSentItems ?? true,
    });
  }

  /**
   * Reply to a message.
   */
  async replyToMessage(messageId: string, comment: string): Promise<void> {
    await this.client.post(`/me/messages/${messageId}/reply`, {
      comment,
    });
  }

  /**
   * Forward a message.
   */
  async forwardMessage(messageId: string, toRecipients: string[], comment?: string): Promise<void> {
    await this.client.post(`/me/messages/${messageId}/forward`, {
      toRecipients: toRecipients.map(email => ({ emailAddress: { address: email } })),
      comment,
    });
  }

  /**
   * Mark message as read/unread.
   */
  async updateMessageReadStatus(messageId: string, isRead: boolean): Promise<Message> {
    return this.client.patch<Message>(`/me/messages/${messageId}`, { isRead });
  }

  /**
   * Delete a message (move to deleted items).
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.client.delete(`/me/messages/${messageId}`);
  }

  /**
   * List mail folders.
   */
  async listMailFolders(): Promise<ODataResponse<MailFolder>> {
    return this.client.get<ODataResponse<MailFolder>>('/me/mailfolders');
  }

  /**
   * Get message attachments.
   */
  async listAttachments(messageId: string): Promise<ODataResponse<Attachment>> {
    return this.client.get<ODataResponse<Attachment>>(`/me/messages/${messageId}/attachments`);
  }

  /**
   * Get a specific attachment.
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Attachment> {
    return this.client.get<Attachment>(`/me/messages/${messageId}/attachments/${attachmentId}`);
  }

  // --------------------------------------------------------------------------
  // Calendar Operations
  // --------------------------------------------------------------------------

  /**
   * List calendars.
   */
  async listCalendars(): Promise<ODataResponse<Calendar>> {
    return this.client.get<ODataResponse<Calendar>>('/me/calendars');
  }

  /**
   * List calendar events.
   */
  async listEvents(options?: ListEventsOptions): Promise<ODataResponse<Event>> {
    let path = options?.calendarId
      ? `/me/calendars/${options.calendarId}/events`
      : '/me/events';

    // Use calendarView for date range queries
    if (options?.startDateTime && options?.endDateTime) {
      path = options?.calendarId
        ? `/me/calendars/${options.calendarId}/calendarView`
        : '/me/calendarView';
    }

    const params: Record<string, string | number | undefined> = {};

    if (options?.startDateTime) params.startDateTime = options.startDateTime;
    if (options?.endDateTime) params.endDateTime = options.endDateTime;
    if (options?.top) params.$top = options.top;
    if (options?.skip) params.$skip = options.skip;
    if (options?.filter) params.$filter = options.filter;
    if (options?.select) params.$select = options.select;
    if (options?.orderBy) params.$orderby = options.orderBy;
    else params.$orderby = 'start/dateTime';

    return this.client.get<ODataResponse<Event>>(path, { params });
  }

  /**
   * Get a specific event.
   */
  async getEvent(eventId: string): Promise<Event> {
    return this.client.get<Event>(`/me/events/${eventId}`);
  }

  /**
   * Create a new calendar event.
   */
  async createEvent(options: CreateEventOptions): Promise<Event> {
    const path = options.calendarId
      ? `/me/calendars/${options.calendarId}/events`
      : '/me/events';

    const start: DateTimeTimeZone = {
      dateTime: options.start.dateTime,
      timeZone: options.start.timeZone || 'UTC',
    };

    const end: DateTimeTimeZone = {
      dateTime: options.end.dateTime,
      timeZone: options.end.timeZone || 'UTC',
    };

    const attendees: Attendee[] | undefined = options.attendees?.map(email => ({
      emailAddress: { address: email },
      type: 'required' as const,
    }));

    const body: ItemBody | undefined = options.body
      ? { contentType: options.contentType || 'html', content: options.body }
      : undefined;

    return this.client.post<Event>(path, {
      subject: options.subject,
      body,
      start,
      end,
      location: options.location ? { displayName: options.location } : undefined,
      attendees,
      isAllDay: options.isAllDay,
      isOnlineMeeting: options.isOnlineMeeting,
      onlineMeetingProvider: options.isOnlineMeeting ? 'teamsForBusiness' : undefined,
    });
  }

  /**
   * Update an event.
   */
  async updateEvent(eventId: string, updates: Partial<CreateEventOptions>): Promise<Event> {
    const body: Record<string, unknown> = {};

    if (updates.subject) body.subject = updates.subject;
    if (updates.body) {
      body.body = { contentType: updates.contentType || 'html', content: updates.body };
    }
    if (updates.start) {
      body.start = { dateTime: updates.start.dateTime, timeZone: updates.start.timeZone || 'UTC' };
    }
    if (updates.end) {
      body.end = { dateTime: updates.end.dateTime, timeZone: updates.end.timeZone || 'UTC' };
    }
    if (updates.location) {
      body.location = { displayName: updates.location };
    }
    if (updates.isAllDay !== undefined) body.isAllDay = updates.isAllDay;

    return this.client.patch<Event>(`/me/events/${eventId}`, body);
  }

  /**
   * Delete an event.
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.client.delete(`/me/events/${eventId}`);
  }

  /**
   * Accept a meeting invitation.
   */
  async acceptEvent(eventId: string, sendResponse: boolean = true, comment?: string): Promise<void> {
    await this.client.post(`/me/events/${eventId}/accept`, { sendResponse, comment });
  }

  /**
   * Decline a meeting invitation.
   */
  async declineEvent(eventId: string, sendResponse: boolean = true, comment?: string): Promise<void> {
    await this.client.post(`/me/events/${eventId}/decline`, { sendResponse, comment });
  }

  /**
   * Tentatively accept a meeting invitation.
   */
  async tentativelyAcceptEvent(eventId: string, sendResponse: boolean = true, comment?: string): Promise<void> {
    await this.client.post(`/me/events/${eventId}/tentativelyAccept`, { sendResponse, comment });
  }
}
