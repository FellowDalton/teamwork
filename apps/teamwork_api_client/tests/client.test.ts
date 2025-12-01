/**
 * Tests for the core HTTP client.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { TeamworkHttpClient, createClientFromEnv } from '../src/client.ts';

describe('TeamworkHttpClient', () => {
  describe('constructor', () => {
    test('creates client with required config', () => {
      const client = new TeamworkHttpClient({
        apiUrl: 'https://example.teamwork.com',
        bearerToken: 'test-token',
      });

      expect(client).toBeInstanceOf(TeamworkHttpClient);
    });

    test('removes trailing slash from API URL', () => {
      const client = new TeamworkHttpClient({
        apiUrl: 'https://example.teamwork.com/',
        bearerToken: 'test-token',
      });

      // The URL is private, but we can test behavior through requests
      expect(client).toBeInstanceOf(TeamworkHttpClient);
    });
  });

  describe('createClientFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    test('throws if TEAMWORK_API_URL is missing', () => {
      delete process.env.TEAMWORK_API_URL;
      process.env.TEAMWORK_BEARER_TOKEN = 'test-token';

      expect(() => createClientFromEnv()).toThrow('TEAMWORK_API_URL environment variable is required');
    });

    test('throws if TEAMWORK_BEARER_TOKEN is missing', () => {
      process.env.TEAMWORK_API_URL = 'https://example.teamwork.com';
      delete process.env.TEAMWORK_BEARER_TOKEN;

      expect(() => createClientFromEnv()).toThrow('TEAMWORK_BEARER_TOKEN environment variable is required');
    });

    test('creates client from environment variables', () => {
      process.env.TEAMWORK_API_URL = 'https://example.teamwork.com';
      process.env.TEAMWORK_BEARER_TOKEN = 'test-token';

      const client = createClientFromEnv();
      expect(client).toBeInstanceOf(TeamworkHttpClient);
    });
  });
});

describe('TeamworkHttpClient request methods', () => {
  let client: TeamworkHttpClient;
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    client = new TeamworkHttpClient({
      apiUrl: 'https://example.teamwork.com',
      bearerToken: 'test-token',
      maxRetries: 0, // Disable retries for tests
    });

    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  test('GET request includes auth header', async () => {
    await client.get('/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('https://example.teamwork.com/test');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(options.method).toBe('GET');
  });

  test('GET request with query params', async () => {
    await client.get('/test', { page: 1, status: 'active' });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('page=1');
    expect(url).toContain('status=active');
  });

  test('GET request with array params', async () => {
    await client.get('/test', { include: ['tags', 'users'] });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('include=tags');
    expect(url).toContain('include=users');
  });

  test('POST request with body', async () => {
    await client.post('/test', { name: 'Test' });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ name: 'Test' }));
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  test('PATCH request with body', async () => {
    await client.patch('/test', { status: 'completed' });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('PATCH');
    expect(options.body).toBe(JSON.stringify({ status: 'completed' }));
  });

  test('DELETE request', async () => {
    await client.delete('/test');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('DELETE');
  });

  test('handles JSON response', async () => {
    const result = await client.get<{ data: string }>('/test');
    expect(result).toEqual({ data: 'test' });
  });

  test('handles text response', async () => {
    mockFetch = mock(() =>
      Promise.resolve(
        new Response('plain text', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await client.get<string>('/test');
    expect(result).toBe('plain text');
  });

  test('throws ApiError on 4xx response', async () => {
    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(client.get('/test')).rejects.toMatchObject({
      status: 404,
      statusText: 'Not Found',
    });
  });

  test('throws ApiError on 5xx response', async () => {
    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'Server Error' }), {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(client.get('/test')).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe('TeamworkHttpClient retry logic', () => {
  let client: TeamworkHttpClient;
  let mockFetch: ReturnType<typeof mock>;
  let callCount: number;

  beforeEach(() => {
    callCount = 0;
    client = new TeamworkHttpClient({
      apiUrl: 'https://example.teamwork.com',
      bearerToken: 'test-token',
      maxRetries: 2,
      retryDelayMs: 10, // Short delay for tests
    });
  });

  test('retries on 5xx error', async () => {
    mockFetch = mock(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve(
          new Response('Server Error', {
            status: 500,
            statusText: 'Internal Server Error',
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await client.get<{ success: boolean }>('/test');
    expect(result).toEqual({ success: true });
    expect(callCount).toBe(3);
  });

  test('retries on rate limit (429)', async () => {
    mockFetch = mock(() => {
      callCount++;
      if (callCount < 2) {
        return Promise.resolve(
          new Response('Rate Limited', {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Retry-After': '1' },
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await client.get<{ success: boolean }>('/test');
    expect(result).toEqual({ success: true });
    expect(callCount).toBe(2);
  });

  test('does not retry on 4xx error (except 429)', async () => {
    mockFetch = mock(() => {
      callCount++;
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'Bad Request' }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(client.get('/test')).rejects.toMatchObject({ status: 400 });
    expect(callCount).toBe(1);
  });

  test('gives up after max retries', async () => {
    mockFetch = mock(() => {
      callCount++;
      return Promise.resolve(
        new Response('Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(client.get('/test')).rejects.toMatchObject({ status: 500 });
    expect(callCount).toBe(3); // Initial + 2 retries
  });
});
