/**
 * Tags resource module for Teamwork API.
 * Provides tag operations for projects and tasks.
 */

import type { TeamworkHttpClient } from '../client.ts';

export interface Tag {
  id: number;
  name: string;
  color?: string;
  projectId?: number;
}

export interface TagListResponse {
  tags: Tag[];
}

export interface CreateTagOptions {
  /** Tag name (required) */
  name: string;
  /** Tag color (hex without #, e.g., "f44336") */
  color?: string;
  /** Project ID to scope the tag to (optional - site-wide if not provided) */
  projectId?: number;
}

/**
 * Tags resource for Teamwork API.
 */
export class TagsResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * List all tags.
   */
  async list(): Promise<Tag[]> {
    const response = await this.client.get<TagListResponse>('/projects/api/v3/tags.json');
    return response.tags;
  }

  /**
   * List tags for a specific project.
   */
  async listByProject(projectId: number): Promise<Tag[]> {
    const response = await this.client.get<TagListResponse>(
      `/projects/api/v3/projects/${projectId}/tags.json`
    );
    return response.tags;
  }

  /**
   * Get a single tag by ID.
   */
  async get(tagId: number): Promise<Tag> {
    const response = await this.client.get<{ tag: Tag }>(`/projects/api/v3/tags/${tagId}.json`);
    return response.tag;
  }

  /**
   * Create a new tag (V1 API).
   */
  async create(options: CreateTagOptions): Promise<{ id: string; status: string }> {
    const body = {
      tag: {
        name: options.name,
        color: options.color,
        projectId: options.projectId,
      },
    };

    // Remove undefined values
    const tagData = body.tag as Record<string, unknown>;
    Object.keys(tagData).forEach(key => {
      if (tagData[key] === undefined) {
        delete tagData[key];
      }
    });

    const response = await this.client.post<{ id: string; STATUS: string }>('/tags.json', body);
    return { id: response.id, status: response.STATUS };
  }

  /**
   * Find a tag by name.
   */
  async findByName(name: string): Promise<Tag | null> {
    const tags = await this.list();
    const lowerName = name.toLowerCase();
    return tags.find((t) => t.name.toLowerCase() === lowerName) ?? null;
  }

  /**
   * Find or create a tag by name.
   */
  async findOrCreate(name: string, color?: string): Promise<Tag> {
    const existing = await this.findByName(name);
    if (existing) {
      return existing;
    }

    const result = await this.create({ name, color });
    return this.get(parseInt(result.id, 10));
  }
}
