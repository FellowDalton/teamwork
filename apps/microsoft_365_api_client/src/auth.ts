/**
 * OAuth 2.0 authentication for Microsoft Graph API.
 * Supports client credentials flow (app-only) and delegated permissions.
 */

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  ext_expires_in?: number;
  scope?: string;
}

export interface AuthConfig {
  /** Azure tenant ID */
  tenantId: string;
  /** Application (client) ID */
  clientId: string;
  /** Client secret (for client credentials flow) */
  clientSecret?: string;
  /** Scopes to request (defaults to https://graph.microsoft.com/.default) */
  scopes?: string[];
  /** Use delegated permissions with provided access token */
  accessToken?: string;
}

export interface TokenInfo {
  accessToken: string;
  expiresAt: Date;
  scopes: string[];
}

/**
 * Manages OAuth tokens for Microsoft Graph API.
 * Handles automatic token refresh with buffer time.
 */
export class TokenManager {
  private tokenInfo: TokenInfo | null = null;
  private readonly refreshBufferMs = 5 * 60 * 1000; // 5 minutes before expiry

  constructor(private readonly config: AuthConfig) {}

  /**
   * Get a valid access token, refreshing if necessary.
   */
  async getToken(): Promise<string> {
    // If using pre-provided access token (delegated flow)
    if (this.config.accessToken) {
      return this.config.accessToken;
    }

    // Check if current token is still valid
    if (this.tokenInfo && this.isTokenValid()) {
      return this.tokenInfo.accessToken;
    }

    // Fetch new token
    await this.refreshToken();
    return this.tokenInfo!.accessToken;
  }

  /**
   * Check if current token is valid (with buffer time).
   */
  private isTokenValid(): boolean {
    if (!this.tokenInfo) return false;
    const now = new Date();
    const bufferTime = new Date(this.tokenInfo.expiresAt.getTime() - this.refreshBufferMs);
    return now < bufferTime;
  }

  /**
   * Refresh the access token using client credentials flow.
   */
  private async refreshToken(): Promise<void> {
    if (!this.config.clientSecret) {
      throw new Error('Client secret required for token refresh. Provide accessToken for delegated auth.');
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scopes?.join(' ') || 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data: TokenResponse = await response.json();

    this.tokenInfo = {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope?.split(' ') || [],
    };
  }

  /**
   * Clear cached token (for logout or error recovery).
   */
  clearToken(): void {
    this.tokenInfo = null;
  }

  /**
   * Get token info for debugging.
   */
  getTokenInfo(): TokenInfo | null {
    return this.tokenInfo;
  }
}

/**
 * Create a token manager from environment variables.
 */
export function createTokenManagerFromEnv(): TokenManager {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const accessToken = process.env.MICROSOFT_ACCESS_TOKEN;

  if (!tenantId) {
    throw new Error('MICROSOFT_TENANT_ID environment variable is required');
  }

  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID environment variable is required');
  }

  if (!clientSecret && !accessToken) {
    throw new Error('Either MICROSOFT_CLIENT_SECRET or MICROSOFT_ACCESS_TOKEN is required');
  }

  return new TokenManager({
    tenantId,
    clientId,
    clientSecret,
    accessToken,
  });
}
