---
name: Railway CLI Operations
description: Diagnose, debug, and manage Railway deployments using the CLI. Use when troubleshooting deployment failures, checking logs, managing environment variables, or investigating service issues.
triggers:
  - railway
  - deploy
  - deployment failed
  - 502 error
  - application failed to respond
  - deploy logs
  - environment variables
  - railway logs
---

# Railway CLI Operations

## Overview

Use the Railway CLI to diagnose and fix deployment issues directly from the terminal. This skill provides workflows for common debugging scenarios and operational tasks.

## Prerequisites

Ensure Railway CLI is authenticated:
```bash
railway whoami
```

If not authenticated:
```bash
railway login
```

## Diagnostic Workflows

### 1. Deployment Failure Investigation

When a deployment fails or returns 502/503 errors, follow this sequence:

```bash
# Step 1: Link to the project (if not already linked)
railway link

# Step 2: Select the failing service
railway service

# Step 3: Check build logs for compilation/install errors
railway logs --build

# Step 4: Check deployment logs for runtime errors
railway logs --deployment

# Step 5: Get full status
railway status
```

**Common issues revealed by logs:**
- Missing environment variables → "Cannot read X from undefined"
- Port binding issues → Server starts but no connections
- Module not found → Dependency installation failed
- Memory exceeded → Process killed

### 2. Environment Variable Debugging

```bash
# List all variables for current service
railway variables

# List in key=value format (easier to read)
railway variables --kv

# Check specific service's variables
railway variables --service backend

# Set a variable
railway variables --set "KEY=value"

# Set multiple variables
railway variables --set "KEY1=value1" --set "KEY2=value2"
```

**Critical variables to verify for typical backends:**
- `PORT` - Railway sets this automatically, app must read it
- Database URLs - `DATABASE_URL`, `REDIS_URL`
- API keys - `ANTHROPIC_API_KEY`, etc.
- Service URLs - `VITE_API_URL` for frontends

### 3. Live Debugging with SSH

For runtime issues not visible in logs:

```bash
# SSH into the running container
railway ssh

# Run a single command
railway ssh -- ls -la

# Check running processes
railway ssh -- ps aux

# Check environment inside container
railway ssh -- env | grep -i api

# Test network connectivity
railway ssh -- curl -I https://api.example.com
```

### 4. Quick Health Check

```bash
# One-liner diagnostic summary
railway status --json | head -50
railway logs --deployment 2>&1 | tail -100
```

## Common Issues & Solutions

### "Application failed to respond" (502)

**Diagnosis:**
```bash
railway logs --deployment
```

**Common causes:**
1. **Wrong port** - App not listening on `$PORT`
2. **Wrong host** - App listening on `localhost` instead of `0.0.0.0`
3. **Crash on startup** - Missing env vars or failed imports
4. **Timeout** - App takes too long to start

**Fix patterns:**
```javascript
// Node/Bun - Listen on correct host and port
server.listen(process.env.PORT || 3000, '0.0.0.0')

// Bun.serve
Bun.serve({ port: process.env.PORT, hostname: "0.0.0.0" })
```

### Missing Environment Variables

**Diagnosis:**
```bash
railway variables --kv | grep -E "API_KEY|URL|TOKEN"
```

**Fix:**
```bash
railway variables --set "ANTHROPIC_API_KEY=sk-ant-..."
```

### Build Failures

**Diagnosis:**
```bash
railway logs --build
```

**Common causes:**
- Missing `package.json` scripts
- Wrong Node/Bun version
- Private package access issues

### CORS Errors (from frontend)

CORS errors on frontend usually mean backend isn't responding:
```bash
# Check if backend is actually running
railway logs --service backend --deployment
```

If backend crashes, there's no server to send CORS headers.

## Deployment Operations

### Deploy Current Directory

```bash
# Deploy and watch logs
railway up

# Deploy and return immediately
railway up --detach

# Deploy specific service
railway up --service backend
```

### Redeploy Existing

```bash
railway redeploy
```

### Switch Environments

```bash
# Interactive environment selection
railway environment

# Then redeploy to that environment
railway up
```

## Local Development with Railway Env

Run local commands with production/staging environment variables:

```bash
# Run a command with Railway env vars
railway run npm start

# Open shell with Railway env vars loaded
railway shell

# Then run commands normally
npm start
```

## Service Management

```bash
# List and select service
railway service

# Add a database
railway add

# Connect to database CLI
railway connect postgres
```

## Output Formats

For scripting or detailed analysis:

```bash
# JSON output for parsing
railway status --json
railway logs --json
railway variables --json

# Pipe to jq for specific fields
railway status --json | jq '.services'
```

## Debugging Checklist

When a Railway deployment isn't working:

- [ ] `railway logs --build` - Check for build errors
- [ ] `railway logs --deployment` - Check for runtime errors
- [ ] `railway variables --kv` - Verify all required env vars are set
- [ ] `railway status` - Confirm service is linked and deployed
- [ ] Test endpoint directly in browser - Distinguish CORS from actual failure
- [ ] `railway ssh -- env` - Verify env vars inside container
- [ ] Check `PORT` and `hostname` in server code - Must be `0.0.0.0`

## Quick Reference

| Task | Command |
|------|---------|
| View deploy logs | `railway logs` |
| View build logs | `railway logs --build` |
| List env vars | `railway variables --kv` |
| Set env var | `railway variables --set "KEY=value"` |
| SSH into container | `railway ssh` |
| Deploy | `railway up` |
| Redeploy | `railway redeploy` |
| Switch service | `railway service` |
| Project status | `railway status` |
