/**
 * People resource module for Teamwork API.
 * Provides access to user information including current user.
 */

import type { TeamworkHttpClient } from '../client.ts';
import {
  type Person,
  type MeResponse,
  MeResponseSchema,
} from '../types.ts';

/**
 * People resource for Teamwork API.
 */
export class PeopleResource {
  constructor(private readonly client: TeamworkHttpClient) {}

  /**
   * Get the currently authenticated user's information.
   */
  async me(): Promise<Person> {
    const response = await this.client.get<MeResponse>('/projects/api/v3/me.json');
    const parsed = MeResponseSchema.parse(response);
    return parsed.person;
  }

  /**
   * Get the current user's ID.
   * Convenience method for common use case.
   */
  async getCurrentUserId(): Promise<number> {
    const person = await this.me();
    return person.id;
  }

  /**
   * Get the current user's full name.
   */
  async getCurrentUserName(): Promise<string> {
    const person = await this.me();
    return [person.firstName, person.lastName].filter(Boolean).join(' ');
  }
}
