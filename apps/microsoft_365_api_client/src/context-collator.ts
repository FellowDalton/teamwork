/**
 * Context Collator for Microsoft 365.
 * Gathers relevant information across Outlook, Teams, and SharePoint for a given topic.
 */

import type { MicrosoftGraphClient } from './index.ts';
import type { Message, ChatMessage, DriveItem, Event } from './types.ts';

export interface CollatedContext {
  /** Topic/query that was searched */
  topic: string;
  /** Timestamp of context gathering */
  gatheredAt: string;
  /** Summary statistics */
  summary: {
    emailCount: number;
    teamsMessageCount: number;
    fileCount: number;
    eventCount: number;
  };
  /** Relevant emails */
  emails: Array<{
    id: string;
    subject: string;
    from: string;
    receivedAt: string;
    preview: string;
    webLink?: string;
  }>;
  /** Relevant Teams messages */
  teamsMessages: Array<{
    id: string;
    from: string;
    content: string;
    sentAt: string;
    webUrl?: string;
    teamName?: string;
    channelName?: string;
  }>;
  /** Relevant files */
  files: Array<{
    id: string;
    name: string;
    path: string;
    modifiedAt: string;
    modifiedBy: string;
    webUrl?: string;
    size?: number;
  }>;
  /** Related calendar events */
  events: Array<{
    id: string;
    subject: string;
    startTime: string;
    endTime: string;
    organizer: string;
    attendees: string[];
    webLink?: string;
  }>;
}

export interface CollateOptions {
  /** Maximum emails to include */
  maxEmails?: number;
  /** Maximum Teams messages to include */
  maxTeamsMessages?: number;
  /** Maximum files to include */
  maxFiles?: number;
  /** Maximum events to include */
  maxEvents?: number;
  /** Date range for events (days from now) */
  eventDaysRange?: number;
  /** Include email body previews */
  includeBodyPreviews?: boolean;
}

const DEFAULT_OPTIONS: Required<CollateOptions> = {
  maxEmails: 10,
  maxTeamsMessages: 10,
  maxFiles: 10,
  maxEvents: 5,
  eventDaysRange: 30,
  includeBodyPreviews: true,
};

/**
 * Collates context from multiple Microsoft 365 services for a given topic.
 */
export class ContextCollator {
  constructor(private readonly client: MicrosoftGraphClient) {}

  /**
   * Gather context from all Microsoft 365 services for a topic.
   */
  async collateContext(topic: string, options?: CollateOptions): Promise<CollatedContext> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Run all searches in parallel
    const [emailsResult, teamsResult, filesResult, eventsResult] = await Promise.allSettled([
      this.searchEmails(topic, opts.maxEmails, opts.includeBodyPreviews),
      this.searchTeamsMessages(topic, opts.maxTeamsMessages),
      this.searchFiles(topic, opts.maxFiles),
      this.searchEvents(topic, opts.maxEvents, opts.eventDaysRange),
    ]);

    const emails = emailsResult.status === 'fulfilled' ? emailsResult.value : [];
    const teamsMessages = teamsResult.status === 'fulfilled' ? teamsResult.value : [];
    const files = filesResult.status === 'fulfilled' ? filesResult.value : [];
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];

    return {
      topic,
      gatheredAt: new Date().toISOString(),
      summary: {
        emailCount: emails.length,
        teamsMessageCount: teamsMessages.length,
        fileCount: files.length,
        eventCount: events.length,
      },
      emails,
      teamsMessages,
      files,
      events,
    };
  }

  /**
   * Search emails for a topic.
   */
  private async searchEmails(
    query: string,
    limit: number,
    includePreview: boolean
  ): Promise<CollatedContext['emails']> {
    try {
      const response = await this.client.outlook.searchMessages(query, { top: limit });
      return response.value.map((msg: Message) => ({
        id: msg.id,
        subject: msg.subject || '(No subject)',
        from: msg.from?.emailAddress?.address || 'Unknown',
        receivedAt: msg.receivedDateTime || '',
        preview: includePreview ? msg.bodyPreview || '' : '',
        webLink: msg.webLink,
      }));
    } catch (error) {
      console.error('Error searching emails:', error);
      return [];
    }
  }

  /**
   * Search Teams messages for a topic.
   */
  private async searchTeamsMessages(
    query: string,
    limit: number
  ): Promise<CollatedContext['teamsMessages']> {
    try {
      const response = await this.client.teams.searchMessages(query, limit);
      return response.value.map((msg: ChatMessage) => ({
        id: msg.id,
        from: msg.from?.user?.displayName || msg.from?.application?.displayName || 'Unknown',
        content: msg.body?.content || '',
        sentAt: msg.createdDateTime || '',
        webUrl: msg.webUrl,
      }));
    } catch (error) {
      // Search API may not be available for all tenants
      console.error('Error searching Teams messages:', error);
      return [];
    }
  }

  /**
   * Search files for a topic.
   */
  private async searchFiles(query: string, limit: number): Promise<CollatedContext['files']> {
    try {
      const response = await this.client.sharepoint.searchFiles(query, { top: limit });
      return response.value.map((item: DriveItem) => ({
        id: item.id,
        name: item.name,
        path: item.parentReference?.path || '/',
        modifiedAt: item.lastModifiedDateTime || '',
        modifiedBy: item.lastModifiedBy?.user?.displayName || 'Unknown',
        webUrl: item.webUrl,
        size: item.size,
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      return [];
    }
  }

  /**
   * Search events for a topic.
   */
  private async searchEvents(
    query: string,
    limit: number,
    daysRange: number
  ): Promise<CollatedContext['events']> {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + daysRange * 24 * 60 * 60 * 1000);

      const response = await this.client.outlook.listEvents({
        startDateTime: now.toISOString(),
        endDateTime: endDate.toISOString(),
        top: limit * 2, // Get more to filter by query
        filter: `contains(subject, '${query.replace(/'/g, "''")}')`,
      });

      return response.value.slice(0, limit).map((event: Event) => ({
        id: event.id,
        subject: event.subject || '(No subject)',
        startTime: event.start?.dateTime || '',
        endTime: event.end?.dateTime || '',
        organizer: event.organizer?.emailAddress?.address || 'Unknown',
        attendees: event.attendees?.map((a) => a.emailAddress?.address || '') || [],
        webLink: event.webLink,
      }));
    } catch (error) {
      console.error('Error searching events:', error);
      return [];
    }
  }

  /**
   * Format collated context as markdown for Claude.
   */
  formatAsMarkdown(context: CollatedContext): string {
    const lines: string[] = [
      `# Microsoft 365 Context for: ${context.topic}`,
      `*Gathered at: ${context.gatheredAt}*`,
      '',
      '## Summary',
      `- **Emails:** ${context.summary.emailCount}`,
      `- **Teams Messages:** ${context.summary.teamsMessageCount}`,
      `- **Files:** ${context.summary.fileCount}`,
      `- **Events:** ${context.summary.eventCount}`,
      '',
    ];

    if (context.emails.length > 0) {
      lines.push('## Relevant Emails', '');
      for (const email of context.emails) {
        lines.push(`### ${email.subject}`);
        lines.push(`- **From:** ${email.from}`);
        lines.push(`- **Received:** ${email.receivedAt}`);
        if (email.preview) {
          lines.push(`- **Preview:** ${email.preview.substring(0, 200)}...`);
        }
        if (email.webLink) {
          lines.push(`- [Open in Outlook](${email.webLink})`);
        }
        lines.push('');
      }
    }

    if (context.teamsMessages.length > 0) {
      lines.push('## Relevant Teams Messages', '');
      for (const msg of context.teamsMessages) {
        lines.push(`### From: ${msg.from}`);
        lines.push(`- **Sent:** ${msg.sentAt}`);
        lines.push(`- **Content:** ${msg.content.substring(0, 300)}...`);
        if (msg.webUrl) {
          lines.push(`- [Open in Teams](${msg.webUrl})`);
        }
        lines.push('');
      }
    }

    if (context.files.length > 0) {
      lines.push('## Relevant Files', '');
      for (const file of context.files) {
        lines.push(`### ${file.name}`);
        lines.push(`- **Path:** ${file.path}`);
        lines.push(`- **Modified:** ${file.modifiedAt} by ${file.modifiedBy}`);
        if (file.size) {
          lines.push(`- **Size:** ${(file.size / 1024).toFixed(1)} KB`);
        }
        if (file.webUrl) {
          lines.push(`- [Open](${file.webUrl})`);
        }
        lines.push('');
      }
    }

    if (context.events.length > 0) {
      lines.push('## Related Events', '');
      for (const event of context.events) {
        lines.push(`### ${event.subject}`);
        lines.push(`- **When:** ${event.startTime} - ${event.endTime}`);
        lines.push(`- **Organizer:** ${event.organizer}`);
        if (event.attendees.length > 0) {
          lines.push(`- **Attendees:** ${event.attendees.join(', ')}`);
        }
        if (event.webLink) {
          lines.push(`- [Open in Calendar](${event.webLink})`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
