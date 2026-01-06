/**
 * Comments resource module for Teamwork API.
 * Provides comment operations for tasks and other objects.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type Comment,
  type CommentListResponse,
  type CommentResponse,
  type CreateCommentRequest,
  CommentListResponseSchema,
  CommentResponseSchema,
} from '../types.ts';

export interface ListCommentsOptions {
  /** Include related data */
  include?: ('users')[];
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

export interface CreateCommentOptions {
  /** Comment body text */
  body: string;
  /** Content type (TEXT, HTML, or MARKDOWN) */
  contentType?: 'TEXT' | 'HTML' | 'MARKDOWN';
  /** Whether comment is private */
  isPrivate?: boolean;
}

/**
 * Format an ADW status update as a comment.
 */
export interface AdwStatusUpdate {
  /** ADW tracking ID */
  adwId: string;
  /** Status being updated to */
  status: string;
  /** Optional commit hash */
  commitHash?: string;
  /** Optional agent name */
  agentName?: string;
  /** Optional error message */
  errorMessage?: string;
  /** Optional additional message */
  message?: string;
}

/**
 * Comments resource for Teamwork API.
 */
export class CommentsResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * List comments for a task.
   */
  async listForTask(taskId: number, options?: ListCommentsOptions): Promise<CommentListResponse> {
    const params: Record<string, string | number | string[] | undefined> = {};

    if (options?.include?.length) {
      params['include'] = options.include;
    }
    if (options?.page !== undefined) {
      params['page'] = options.page;
    }
    if (options?.pageSize !== undefined) {
      params['pageSize'] = options.pageSize;
    }

    const response = await this.client.get<CommentListResponse>(
      `/projects/api/v3/tasks/${taskId}/comments.json`,
      params
    );
    return CommentListResponseSchema.parse(response);
  }

  /**
   * Create a comment on a task.
   * Note: Uses v1 API which returns {commentId, STATUS, id} instead of full comment
   */
  async createForTask(taskId: number, options: CreateCommentOptions): Promise<{ id: number }> {
    const body = {
      comment: {
        body: options.body,
        // v1 API doesn't support contentType - markdown works by default
        ...(options.isPrivate && { isPrivate: options.isPrivate }),
      },
    };

    const response = await this.client.post<{ commentId: string; STATUS: string; id: string }>(
      `/projects/api/v1/tasks/${taskId}/comments.json`,
      body
    );
    return { id: parseInt(response.id || response.commentId) };
  }

  /**
   * Get a single comment by ID.
   */
  async get(commentId: number): Promise<Comment> {
    const response = await this.client.get<CommentResponse>(`/projects/api/v3/comments/${commentId}.json`);
    const parsed = CommentResponseSchema.parse(response);
    return parsed.comment;
  }

  /**
   * Update a comment.
   */
  async update(commentId: number, body: string, contentType?: 'TEXT' | 'HTML' | 'MARKDOWN'): Promise<Comment> {
    const response = await this.client.patch<CommentResponse>(`/projects/api/v3/comments/${commentId}.json`, {
      comment: {
        body,
        contentType: contentType ?? 'MARKDOWN',
      },
    });
    const parsed = CommentResponseSchema.parse(response);
    return parsed.comment;
  }

  /**
   * Delete a comment.
   */
  async delete(commentId: number): Promise<void> {
    await this.client.delete(`/projects/api/v3/comments/${commentId}.json`);
  }

  /**
   * Format an ADW status update as a markdown comment.
   */
  formatAdwStatusComment(update: AdwStatusUpdate): string {
    const emojiMap: Record<string, string> = {
      'In Progress': '🔄',
      'In progress': '🔄',
      'in progress': '🔄',
      Complete: '✅',
      complete: '✅',
      Completed: '✅',
      completed: '✅',
      Done: '✅',
      done: '✅',
      Failed: '❌',
      failed: '❌',
      Review: '👁️',
      review: '👁️',
      Blocked: '🚫',
      blocked: '🚫',
    };

    const emoji = emojiMap[update.status] ?? 'ℹ️';

    const lines: string[] = [
      `${emoji} **Status Update: ${update.status}**`,
      '',
      `- **ADW ID**: \`${update.adwId}\``,
      `- **Timestamp**: ${new Date().toISOString()}`,
    ];

    if (update.commitHash) {
      lines.push(`- **Commit**: \`${update.commitHash}\``);
    }

    if (update.agentName) {
      lines.push(`- **Agent**: ${update.agentName}`);
    }

    lines.push('');
    lines.push('---');

    if (update.errorMessage) {
      lines.push('');
      lines.push('**Error:**');
      lines.push('```');
      lines.push(update.errorMessage);
      lines.push('```');
    } else if (update.message) {
      lines.push('');
      lines.push(update.message);
    }

    return lines.join('\n');
  }

  /**
   * Post an ADW status update comment on a task.
   */
  async postAdwStatusUpdate(taskId: number, update: AdwStatusUpdate): Promise<Comment> {
    const body = this.formatAdwStatusComment(update);
    return this.createForTask(taskId, {
      body,
      contentType: 'MARKDOWN',
    });
  }

  /**
   * Post a simple text comment on a task.
   */
  async postText(taskId: number, text: string): Promise<Comment> {
    return this.createForTask(taskId, {
      body: text,
      contentType: 'TEXT',
    });
  }

  /**
   * Post a markdown comment on a task.
   */
  async postMarkdown(taskId: number, markdown: string): Promise<Comment> {
    return this.createForTask(taskId, {
      body: markdown,
      contentType: 'MARKDOWN',
    });
  }
}
