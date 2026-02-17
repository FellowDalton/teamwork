# Setting Up Claude Code with a Subscription (Instead of API Key)

## Overview

Claude Code can authenticate in two ways:

| Method | Auth | Billing | Best For |
|--------|------|---------|----------|
| **API Key** | `ANTHROPIC_API_KEY` env var | Per-token usage | CI/CD, automation, high-volume |
| **Subscription** | OAuth via claude.ai | Fixed monthly fee | Interactive development |

With a **Claude Max subscription** ($100/mo or $200/mo), you get Claude Code access included — no API key or per-token billing needed. You can also generate an OAuth token from your subscription to use in your own apps with the `@anthropic-ai/sdk`.

---

## Step 1: Get a Claude Max Subscription

1. Go to [claude.ai](https://claude.ai)
2. Subscribe to **Claude Pro** ($20/mo) or **Claude Max** ($100/mo or $200/mo)
   - **Pro** gives limited Claude Code usage
   - **Max** gives extended Claude Code usage with access to Opus

---

## Step 2: Authenticate Claude Code (CLI)

### Remove API Key Auth (if present)

If you're currently using an API key, remove it:

```bash
# Remove from your shell profile (~/.zshrc, ~/.bashrc, etc.)
# Delete or comment out this line:
# export ANTHROPIC_API_KEY="sk-ant-..."

# Unset it in your current session
unset ANTHROPIC_API_KEY

# Log out of any existing auth
claude auth logout
```

### Log In with Your Subscription

```bash
claude auth login
```

This opens a browser window where you sign in to your claude.ai account. Once authenticated, Claude Code uses your subscription.

### Verify

```bash
claude auth status
```

You should see:

```json
{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "apiProvider": "firstParty",
  "email": "your-email@example.com",
  "subscriptionType": "max"
}
```

Key fields to confirm:
- `authMethod: "claude.ai"` (not `"api_key"`)
- `apiProvider: "firstParty"` (not `"anthropic"`)
- `subscriptionType: "max"` or `"pro"`

---

## Step 3: Generate an OAuth Token for Your Apps

If your project uses the `@anthropic-ai/sdk` server-side (e.g. an API route that calls Claude), you don't need a separate Console API key. You can generate an OAuth token from your subscription:

```bash
claude setup-token
```

This opens your browser to `claude.ai/oauth/authorize`. Sign in with your Claude account, and the CLI outputs an OAuth token:

```
sk-ant-oat01-...
```

This token is valid for approximately 1 year.

### Use It in Your Project

Add the token to your project's `.env.local` (or equivalent):

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-oat01-...
```

The `@anthropic-ai/sdk` accepts this token the same way it accepts a regular API key. Your app's API calls are now billed through your subscription — no separate Console account or per-token billing needed.

### Alternatively: Use `CLAUDE_CODE_OAUTH_TOKEN`

You can also set it as a dedicated env var if you want to keep it separate:

```bash
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
```

---

## Step 4: Start Using It

### Claude Code CLI

Navigate to your project and run:

```bash
cd /path/to/your/project
claude
```

The CLI auth is global to your machine — it works in every project directory with no per-project configuration.

### Your App's Server-Side Code

Your app code (e.g. `@anthropic-ai/sdk`) uses the OAuth token from `.env.local` as described in Step 3. No code changes needed — the SDK treats it like a regular API key.

---

## How It Works

- **CLI auth is machine-wide**: `claude auth login` stores credentials in `~/.claude/`
- **App auth uses the OAuth token**: `claude setup-token` generates a token you add to `.env.local`
- **Single billing source**: Both CLI usage and app API calls go through your claude.ai subscription
- **No Console account needed**: You don't need to create a separate account at console.anthropic.com

---

## Troubleshooting

### CLI still using API key?

If `claude auth status` shows `authMethod: "api_key"`, Claude Code is picking up an `ANTHROPIC_API_KEY` from your environment. The API key takes precedence. Remove it:

```bash
unset ANTHROPIC_API_KEY
# Then remove it from ~/.zshrc or ~/.bashrc permanently
```

### Login fails or times out?

```bash
# Try logging out first, then back in
claude auth logout
claude auth login
```

### Using SSO (corporate account)?

```bash
claude auth login --sso
```

### Token expired?

OAuth tokens from `claude setup-token` last about 1 year. When it expires, just run:

```bash
claude setup-token
```

And update the token in your `.env.local`.

---

## Quick Reference

```bash
# Switch from API key to subscription — full sequence:
unset ANTHROPIC_API_KEY         # Remove from current session
claude auth logout              # Clear any existing auth
claude auth login               # Opens browser, sign in to claude.ai
claude auth status              # Verify: should show "claude.ai" + "max"

# Generate OAuth token for your app's server-side SDK usage:
claude setup-token              # Opens browser, outputs sk-ant-oat01-...
# Add the token to .env.local as ANTHROPIC_API_KEY

# Remove ANTHROPIC_API_KEY from ~/.zshrc or ~/.bashrc permanently
# Done. CLI + app both use your subscription.
```
