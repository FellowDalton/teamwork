/**
 * Core HTTP client for Microsoft Graph API.
 * Provides authenticated requests with retry logic and rate limiting.
 */

import { TokenManager, type AuthConfig } from './auth.ts';

export interface GraphClientConfig extends AuthConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Max retry attempts for transient failures */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff */
  retryDelayMs?: number;
  /** Use beta API instead of v1.0 */
  useBeta?: boolean;
}

export interface RequestOptions {
  /** Query parameters (OData: $filter, $select, $expand, $top, etc.) */
  params?: Record<string, string | number | boolean | string[] | undefined>;
  /** Request body for POST/PATCH/PUT */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** API version override (v1.0 or beta) */
  apiVersion?: 'v1.0' | 'beta';
}

export interface ApiError extends Error {
  status: number;
  statusText: string;
  code?: string;
  body?: unknown;
}

export interface ODataResponse<T> {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
}

/**
 * Create an API error with status information.
 */
function createApiError(status: number, statusText: string, body?: unknown): ApiError {
  const code = (body as { error?: { code?: string } })?.error?.code;
  const message = (body as { error?: { message?: string } })?.error?.message;
  const error = new Error(
    `Microsoft Graph API Error: ${status} ${statusText}${code ? ` (${code})` : ''}${message ? `: ${message}` : ''}`
  ) as ApiError;
  error.status = status;
  error.statusText = statusText;
  error.code = code;
  error.body = body;
  return error;
}

/**
 * Core HTTP client for Microsoft Graph API.
 */
export class MicrosoftGraphHttpClient {
  private readonly tokenManager: TokenManager;
  private readonly debug: boolean;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly baseUrl: string;

  constructor(config: GraphClientConfig) {
    this.tokenManager = new TokenManager(config);
    this.debug = config.debug ?? false;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.baseUrl = config.useBeta
      ? 'https://graph.microsoft.com/beta'
      : 'https://graph.microsoft.com/v1.0';
  }

  /**
   * Log debug messages if debug mode is enabled.
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[MicrosoftGraph]', ...args);
    }
  }

  /**
   * Build URL with query parameters.
   */
  private buildUrl(path: string, params?: RequestOptions['params'], apiVersion?: string): string {
    const base = apiVersion
      ? `https://graph.microsoft.com/${apiVersion}`
      : this.baseUrl;
    const url = new URL(`${base}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (Array.isArray(value)) {
          // Handle array params
          for (const item of value) {
            url.searchParams.append(key, item);
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Sleep for specified milliseconds.
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable.
   */
  private isRetryable(status: number): boolean {
    // Retry on rate limiting, server errors, and service unavailable
    return status === 429 || status === 503 || status === 504 || status >= 500;
  }

  /**
   * Make an HTTP request with retry logic.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params, options?.apiVersion);

    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const token = await this.tokenManager.getToken();

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options?.headers,
        };

        const fetchOptions: RequestInit = {
          method,
          headers,
        };

        if (options?.body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
          fetchOptions.body = JSON.stringify(options.body);
        }

        this.log(`${method} ${url}`, attempt > 0 ? `(attempt ${attempt + 1})` : '');

        const response = await fetch(url, fetchOptions);

        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.retryDelayMs * Math.pow(2, attempt);
          this.log(`Rate limited, waiting ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        // Handle server errors with retry
        if (this.isRetryable(response.status) && attempt < this.maxRetries) {
          const waitTime = this.retryDelayMs * Math.pow(2, attempt);
          this.log(`Server error ${response.status}, retrying in ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        // Parse response body
        let body: unknown;
        const contentType = response.headers.get('Content-Type');
        if (contentType?.includes('application/json')) {
          body = await response.json();
        } else if (response.status === 204) {
          // No content
          body = undefined;
        } else {
          body = await response.text();
        }

        // Handle errors
        if (!response.ok) {
          throw createApiError(response.status, response.statusText, body);
        }

        this.log(`Response:`, response.status, response.statusText);

        return body as T;
      } catch (error) {
        if (error instanceof Error && 'status' in error) {
          lastError = error as ApiError;

          // Don't retry client errors (4xx) except rate limiting
          if (lastError.status >= 400 && lastError.status < 500 && lastError.status !== 429) {
            throw lastError;
          }
        } else {
          // Network error - retry
          lastError = createApiError(0, 'Network Error', String(error));
        }

        if (attempt < this.maxRetries) {
          const waitTime = this.retryDelayMs * Math.pow(2, attempt);
          this.log(`Error, retrying in ${waitTime}ms:`, lastError.message);
          await this.sleep(waitTime);
        }
      }
    }

    throw lastError ?? createApiError(0, 'Unknown Error');
  }

  /**
   * Make a GET request.
   */
  async get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * Make a POST request.
   */
  async post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  /**
   * Make a PATCH request.
   */
  async patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  /**
   * Make a PUT request.
   */
  async put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  /**
   * Make a DELETE request.
   */
  async delete<T = void>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /**
   * Fetch all pages of a paginated response.
   */
  async getAllPages<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T[]> {
    const allItems: T[] = [];
    let nextLink: string | undefined = path;

    while (nextLink) {
      const isFullUrl = nextLink.startsWith('https://');
      const response = await this.get<ODataResponse<T>>(
        isFullUrl ? nextLink.replace(this.baseUrl, '') : nextLink,
        options
      );

      allItems.push(...response.value);
      nextLink = response['@odata.nextLink'];
    }

    return allItems;
  }

  /**
   * Clear cached token (for logout or error recovery).
   */
  clearToken(): void {
    this.tokenManager.clearToken();
  }
}

/**
 * Create a Microsoft Graph HTTP client from environment variables.
 */
export function createHttpClientFromEnv(debug?: boolean): MicrosoftGraphHttpClient {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const accessToken = process.env.MICROSOFT_ACCESS_TOKEN;
  const useBeta = process.env.MICROSOFT_USE_BETA === 'true';

  if (!tenantId) {
    throw new Error('MICROSOFT_TENANT_ID environment variable is required');
  }

  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID environment variable is required');
  }

  if (!clientSecret && !accessToken) {
    throw new Error('Either MICROSOFT_CLIENT_SECRET or MICROSOFT_ACCESS_TOKEN is required');
  }

  return new MicrosoftGraphHttpClient({
    tenantId,
    clientId,
    clientSecret,
    accessToken,
    debug,
    useBeta,
  });
}
