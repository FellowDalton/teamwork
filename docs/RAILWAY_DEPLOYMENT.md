# Railway Deployment Guide

Deploy the Teamwork AI Flow application to Railway as two separate services from a single monorepo.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Railway Project                         │
├─────────────────────────────┬───────────────────────────────┤
│      Frontend Service       │       Backend Service          │
│  (Static Vite Build)        │    (Bun + Agent SDK)           │
│                             │                                │
│  - Serves dist/ files       │  - API endpoints (/api/*)      │
│  - Port: auto               │  - Port: 3051                  │
│  - URL: *.railway.app       │  - URL: *.railway.app          │
└─────────────────────────────┴───────────────────────────────┘
                    │                        ▲
                    │   VITE_API_URL         │
                    └────────────────────────┘
```

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository connected to Railway
- Environment variables ready (see below)

## Step 1: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose the `teamwork` repository

## Step 2: Configure Backend Service

### 2.1 Create the Service
1. In your Railway project, the initial service will be created
2. Rename it to `backend` for clarity

### 2.2 Set Root Directory
1. Click on the service → **Settings**
2. Under **Source**, set **Root Directory** to:
   ```
   apps/teamwork_backend
   ```

### 2.3 Verify Build Settings
Railway should auto-detect the configuration from `railway.json`:
- **Builder**: RAILPACK (auto-detects Bun)
- **Start Command**: `bun run server-sdk.ts`
- **Health Check**: `/health`

### 2.4 Set Environment Variables
Go to **Variables** tab and add:

| Variable | Value | Required |
|----------|-------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes (or use OAuth below) |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Max | Alternative to API key |
| `TEAMWORK_API_URL` | `https://yourcompany.teamwork.com` | Yes |
| `TEAMWORK_BEARER_TOKEN` | Your Teamwork API token | Yes |
| `TEAMWORK_PROJECT_ID` | Default project ID (e.g., `12345`) | Yes |
| `TEAMWORK_FRONTEND_PORT` | `3051` | Optional (defaults to 3051) |

### 2.5 Generate Domain
1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Note the URL (e.g., `backend-production-xxxx.up.railway.app`)

## Step 3: Configure Frontend Service

### 3.1 Create New Service
1. In Railway project, click **+ New**
2. Select **GitHub Repo** → same repository
3. Rename to `frontend`

### 3.2 Set Root Directory
1. Click on service → **Settings**
2. Under **Source**, set **Root Directory** to:
   ```
   apps/teamwork_frontend
   ```

### 3.3 Verify Build Settings
Railway should auto-detect the configuration from `railway.json`:
- **Builder**: RAILPACK (auto-detects Bun)
- **Build Command**: `bun run build`
- **Start Command**: `bunx serve dist -s -l $PORT`

### 3.4 Set Environment Variables
Go to **Variables** tab and add:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_URL` | Backend URL from Step 2.5 (e.g., `https://backend-production-xxxx.up.railway.app`) | Yes |

> **Important**: `VITE_API_URL` is used at **build time** to configure API endpoints. Changes require a redeploy.

### 3.5 Generate Domain
1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. This is your public application URL

## Step 4: Configure CORS (Backend)

The backend needs to allow requests from the frontend domain. Add CORS headers to `server-sdk.ts` if not already present:

```typescript
// In your server response headers
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
```

Add `FRONTEND_URL` to backend environment variables with your frontend Railway URL.

## Environment Variables Summary

### Backend Service
```env
# Claude AI (choose one)
ANTHROPIC_API_KEY=sk-ant-...
# OR
CLAUDE_CODE_OAUTH_TOKEN=...

# Teamwork Integration
TEAMWORK_API_URL=https://yourcompany.teamwork.com
TEAMWORK_BEARER_TOKEN=your-token
TEAMWORK_PROJECT_ID=12345

# Optional
TEAMWORK_FRONTEND_PORT=3051
FRONTEND_URL=https://frontend-production-xxxx.up.railway.app
```

### Frontend Service
```env
VITE_API_URL=https://backend-production-xxxx.up.railway.app
```

## Deployment Workflow

### Initial Deployment
1. Push code to GitHub
2. Railway auto-deploys both services
3. Backend deploys first (no build-time dependencies)
4. Frontend builds with `VITE_API_URL` baked in

### Subsequent Deployments
- Push to `main` branch triggers auto-deploy
- Or manually trigger from Railway dashboard

### Rollbacks
1. Go to service → **Deployments**
2. Click on a previous deployment
3. Select **Rollback**

## Troubleshooting

### Frontend can't reach backend
1. Verify `VITE_API_URL` is set correctly (no trailing slash)
2. Check backend health: `curl https://backend-xxx.up.railway.app/health`
3. Check CORS headers are configured

### Build fails
1. Check build logs in Railway dashboard
2. Verify `bun.lock` is committed
3. Ensure all dependencies are in `package.json`

### Environment variables not working
1. Frontend: `VITE_*` vars are build-time only - redeploy after changes
2. Backend: Changes apply on next deploy or restart

### Health check failing
1. Verify `/health` endpoint returns 200
2. Check backend logs for startup errors
3. Ensure port matches `TEAMWORK_FRONTEND_PORT` or defaults to 3051

## Cost Optimization

- **Hobby Plan**: $5/month per service (good for testing)
- **Pro Plan**: Pay for actual usage
- Consider using a single service (backend serves frontend) for lower costs

## Monitoring

1. **Logs**: Railway dashboard → Service → **Logs**
2. **Metrics**: Railway dashboard → Service → **Metrics**
3. **Health**: Configure health check path in `railway.json`

## Security Checklist

- [ ] API keys stored in Railway Variables (not in code)
- [ ] CORS configured to allow only frontend domain
- [ ] Health check endpoint doesn't expose sensitive info
- [ ] HTTPS enforced (Railway provides this automatically)

## Project Structure

```
apps/
├── teamwork_api_client/    # Shared Teamwork API client
├── teamwork_backend/       # Backend service (Bun + Agent SDK)
│   ├── services/
│   │   └── agentService.ts
│   ├── package.json
│   ├── railway.json
│   ├── server-sdk.ts
│   ├── server.ts
│   ├── tsconfig.json
│   └── types.ts
└── teamwork_frontend/      # Frontend service (React + Vite)
    ├── components/
    ├── contexts/
    ├── hooks/
    ├── lib/
    ├── services/
    ├── types/
    ├── utils/
    ├── App.tsx
    ├── index.html
    ├── index.tsx
    ├── package.json
    ├── railway.json
    ├── tsconfig.json
    ├── types.ts
    └── vite.config.ts
```
