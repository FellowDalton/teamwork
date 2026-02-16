/**
 * Core HTTP client for Teamwork API v3.
 * Provides authenticated requests with retry logic and rate limiting.
 */

export interface TeamworkClientConfig {
  /** Teamwork API base URL (e.g., https://deliver.fellow.dk) */
  apiUrl: string;
  /** Bearer token for authentication */
  bearerToken: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Max retry attempts for transient failures */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff */
  retryDelayMs?: number;
}

export interface RequestOptions {
  /** Query parameters */
  params?: Record<string, string | number | boolean | string[] | undefined>;
  /** Request body for POST/PATCH */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
}

export interface ApiError extends Error {
  status: number;
  statusText: string;
  body?: unknown;
}

/**
 * Create an API error with status information.
 */
function createApiError(status: number, statusText: string, body?: unknown): ApiError {
  const error = new Error(`Teamwork API Error: ${status} ${statusText}`) as ApiError;
  error.status = status;
  error.statusText = statusText;
  error.body = body;
  return error;
}

/**
 * Core HTTP client for Teamwork API.
 */
export class TeamworkHttpClient {
  private readonly apiUrl: string;
  private readonly bearerToken: string;
  private readonly debug: boolean;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(config: TeamworkClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.bearerToken = config.bearerToken;
    this.debug = config.debug ?? false;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  /**
   * Log debug messages if debug mode is enabled.
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[TeamworkClient]', ...args);
    }
  }

  /**
   * Build URL with query parameters.
   */
  private buildUrl(path: string, params?: RequestOptions['params']): string {
    const url = new URL(`${this.apiUrl}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (Array.isArray(value)) {
          // Handle array params (e.g., include[]=stages&include[]=projects)
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
    // Retry on rate limiting, server errors, and network issues
    return status === 429 || status >= 500;
  }

  /**
   * Make an HTTP request with retry logic.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);

    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.bearerToken}:X`).toString('base64')}`,
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

    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.log(`${method} ${url}`, attempt > 0 ? `(attempt ${attempt + 1})` : '');

        const response = await fetch(url, fetchOptions);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelayMs * Math.pow(2, attempt);
          this.log(`Rate limited, waiting ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        // Handle server errors with retry
        if (response.status >= 500 && attempt < this.maxRetries) {
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
  async get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  /**
   * Make a POST request.
   */
  async post<T>(path: string, body?: unknown, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>('POST', path, { body, params });
  }

  /**
   * Make a PATCH request.
   */
  async patch<T>(path: string, body?: unknown, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>('PATCH', path, { body, params });
  }

  /**
   * Make a PUT request.
   */
  async put<T>(path: string, body?: unknown, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>('PUT', path, { body, params });
  }

  /**
   * Make a DELETE request.
   */
  async delete<T = void>(path: string, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>('DELETE', path, { params });
  }
}

/**
 * Create a Teamwork HTTP client from environment variables.
 */
export function createClientFromEnv(debug?: boolean): TeamworkHttpClient {
  const apiUrl = process.env.TEAMWORK_API_URL;
  const bearerToken = process.env.TEAMWORK_BEARER_TOKEN;

  if (!apiUrl) {
    throw new Error('TEAMWORK_API_URL environment variable is required');
  }

  if (!bearerToken) {
    throw new Error('TEAMWORK_BEARER_TOKEN environment variable is required');
  }

  return new TeamworkHttpClient({
    apiUrl,
    bearerToken,
    debug,
  });
}
