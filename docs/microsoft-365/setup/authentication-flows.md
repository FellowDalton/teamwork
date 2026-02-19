# Authentication Flows Guide

Microsoft Graph API supports multiple authentication flows. This guide covers the options available with our client.

## Overview

| Flow | Use Case | User Required | Admin Consent |
|------|----------|---------------|---------------|
| Client Credentials | Background services, daemons | No | Yes |
| Authorization Code | Web apps acting as user | Yes | Sometimes |
| Device Code | CLI tools, IoT devices | Yes | Sometimes |
| Delegated Token | Pre-authenticated user | Yes | No |

## Client Credentials Flow (App-Only)

Best for automated services that run without user interaction.

### How It Works

```
App → Request Token → Azure AD → Access Token → Microsoft Graph
```

### Configuration

```typescript
import { createMicrosoftClient } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClient({
  tenantId: process.env.MICROSOFT_TENANT_ID!,
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
});
```

### Limitations

- Requires admin consent for all permissions
- No user context - operates on all mailboxes/files
- Some APIs not available (e.g., `/me` endpoints)
- Must use absolute user IDs: `/users/{user-id}/messages`

### When to Use

- Background job processing
- Scheduled data sync
- Administrative tasks
- Multi-tenant applications

## Delegated Token Flow

Use when you have a pre-obtained user access token (from another OAuth flow).

### Configuration

```typescript
import { createMicrosoftClient } from './apps/microsoft_365_api_client/src/index.ts';

// Token obtained via separate OAuth flow
const userAccessToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOi...';

const client = createMicrosoftClient({
  tenantId: process.env.MICROSOFT_TENANT_ID!,
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  accessToken: userAccessToken,
});

// Now operations use user's context
const myEmails = await client.outlook.listMessages(); // /me/messages
```

### When to Use

- CLI tools with user login
- Web apps after OAuth callback
- Mobile apps with user authentication

## Setting Up Device Code Flow (For CLI)

Device code flow allows users to authenticate via browser on another device.

### Implementation

```typescript
// This is a simplified example - actual implementation requires more setup

async function authenticateWithDeviceCode() {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`;

  // Step 1: Request device code
  const deviceCodeResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      scope: 'https://graph.microsoft.com/.default',
    }),
  });

  const { device_code, user_code, verification_uri, expires_in } = await deviceCodeResponse.json();

  console.log(`Go to: ${verification_uri}`);
  console.log(`Enter code: ${user_code}`);

  // Step 2: Poll for token
  const tokenResponse = await pollForToken(device_code);
  return tokenResponse.access_token;
}
```

## Token Management

Our client handles token lifecycle automatically:

### Automatic Refresh

```typescript
// Token is automatically refreshed when near expiration
const client = createMicrosoftClient({
  tenantId: 'xxx',
  clientId: 'xxx',
  clientSecret: 'xxx',
});

// Make requests without worrying about token expiration
const emails = await client.outlook.listMessages();
// ... hours later ...
const moreEmails = await client.outlook.listMessages(); // Token auto-refreshed
```

### Manual Token Clear

```typescript
// Clear cached token (for logout or error recovery)
client.http.clearToken();
```

### Debug Token Info

```typescript
import { createTokenManagerFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const tokenManager = createTokenManagerFromEnv();
const tokenInfo = tokenManager.getTokenInfo();

console.log('Token expires at:', tokenInfo?.expiresAt);
console.log('Scopes:', tokenInfo?.scopes);
```

## Choosing the Right Flow

### Decision Tree

```
Is the app running without user interaction?
├── Yes → Client Credentials
└── No → Is the user already authenticated elsewhere?
    ├── Yes → Delegated Token (pass existing token)
    └── No → Does the app have a web UI?
        ├── Yes → Authorization Code Flow
        └── No → Device Code Flow
```

## Environment Variable Summary

```bash
# Always required
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# For client credentials flow
MICROSOFT_CLIENT_SECRET=your-secret

# For delegated flow (alternative to client secret)
MICROSOFT_ACCESS_TOKEN=user-access-token

# Optional
MICROSOFT_USE_BETA=true  # Use /beta instead of /v1.0
```

## Security Considerations

### Token Storage

- Never store tokens in source code
- Use secure storage (environment variables, key vaults)
- Clear tokens on logout/error

### Secret Rotation

- Rotate client secrets every 6-12 months
- Use multiple secrets during rotation period
- Update all deployments before removing old secret

### Certificate Authentication

For higher security, use certificates instead of secrets:

```bash
# Generate certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Convert for Azure
openssl pkcs12 -export -out cert.pfx -inkey key.pem -in cert.pem
```

Then upload to Azure and configure:

```typescript
const client = createMicrosoftClient({
  tenantId: 'xxx',
  clientId: 'xxx',
  // Certificate auth not yet implemented in this client
  // Use Lokka MCP server for certificate support
});
```
