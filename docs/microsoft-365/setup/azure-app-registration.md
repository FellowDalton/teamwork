# Azure App Registration Guide

This guide walks through setting up an Azure App Registration for Microsoft Graph API access.

## Prerequisites

- Azure account with admin access to Azure Active Directory (Entra ID)
- Microsoft 365 tenant

## Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** (or **Microsoft Entra ID**)
3. Select **App registrations** in the left menu
4. Click **New registration**
5. Fill in the details:
   - **Name**: `Teamwork Microsoft 365 Integration` (or your preferred name)
   - **Supported account types**: Choose based on your needs:
     - Single tenant: Only accounts in your organization
     - Multitenant: Accounts in any Azure AD directory
   - **Redirect URI**: Leave blank for now (needed for delegated auth)
6. Click **Register**

## Step 2: Note Application Details

After registration, note these values (you'll need them later):

- **Application (client) ID**: Found on the Overview page
- **Directory (tenant) ID**: Found on the Overview page

## Step 3: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description (e.g., "Production secret")
4. Choose expiration (recommended: 12-24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately - it won't be shown again!

## Step 4: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose permission type:
   - **Delegated permissions**: For user-context operations
   - **Application permissions**: For background services

### Recommended Permissions

#### Delegated Permissions (for user-context access)

| Permission | Purpose |
|------------|---------|
| `Mail.Read` | Read user's emails |
| `Mail.Send` | Send emails as user |
| `Calendars.Read` | Read user's calendar |
| `Calendars.ReadWrite` | Create/update events |
| `Team.ReadBasic.All` | List user's teams |
| `Channel.ReadBasic.All` | List team channels |
| `Chat.Read` | Read user's chats |
| `ChannelMessage.Read.All` | Read channel messages |
| `Files.Read.All` | Read files in OneDrive/SharePoint |
| `Sites.Read.All` | Read SharePoint sites |
| `User.Read` | Read user profile |

#### Application Permissions (for background services)

| Permission | Purpose |
|------------|---------|
| `Mail.Read` | Read all mailboxes |
| `Mail.Send` | Send as any user |
| `Calendars.Read` | Read all calendars |
| `Team.ReadBasic.All` | List all teams |
| `ChannelMessage.Read.All` | Read all channel messages |
| `Files.Read.All` | Read all files |
| `Sites.Read.All` | Read all sites |
| `User.Read.All` | Read all users |

## Step 5: Grant Admin Consent

For **Application permissions**, admin consent is required:

1. In **API permissions**, click **Grant admin consent for [Your Org]**
2. Confirm the consent dialog

## Step 6: Configure Environment Variables

Create or update your `.env` file:

```bash
# Required
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your-client-secret-value

# Optional
MICROSOFT_USE_BETA=false
```

## Step 7: Test the Connection

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv(true); // Enable debug logging

try {
  const myDrive = await client.sharepoint.getMyDrive();
  console.log('✅ Connection successful!');
  console.log(`Drive: ${myDrive.name}`);
} catch (error) {
  console.error('❌ Connection failed:', error);
}
```

## Troubleshooting

### "AADSTS700016: Application not found"
- Check that the tenant ID and client ID are correct
- Ensure the app is registered in the correct tenant

### "AADSTS7000215: Invalid client secret"
- Client secret may have expired
- Create a new secret and update your configuration

### "Insufficient privileges" / 403 Forbidden
- Required permissions are not granted
- Admin consent may be needed
- Check if the user has access to the resource

### "Request had insufficient authentication scopes"
- Add the required permission in Azure portal
- Grant admin consent if using application permissions

## Security Best Practices

1. **Use certificates instead of secrets** for production
2. **Rotate secrets regularly** (every 6-12 months)
3. **Use least-privilege permissions** - only request what you need
4. **Store secrets securely** - use environment variables or secret managers
5. **Monitor app activity** - check Azure AD sign-in logs
6. **Enable conditional access** for sensitive operations
