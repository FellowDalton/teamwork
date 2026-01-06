#!/bin/bash
#
# Start ngrok tunnel for Teamwork webhook testing
#
# Usage:
#   ./scripts/webhooks/start-tunnel.sh [port]
#
# Default port: 3001 (teamwork_frontend server)
#
# Prerequisites:
#   1. Install ngrok: brew install ngrok
#   2. Create free account at https://ngrok.com
#   3. Add auth token: ngrok config add-authtoken <your-token>
#

PORT=${1:-3001}

echo "=============================================="
echo "  Teamwork Webhook Tunnel (ngrok)"
echo "=============================================="
echo ""
echo "Starting tunnel to localhost:$PORT..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "Error: ngrok is not installed."
    echo ""
    echo "Install with:"
    echo "  brew install ngrok"
    echo ""
    echo "Then authenticate:"
    echo "  1. Create account at https://ngrok.com"
    echo "  2. Get auth token from dashboard"
    echo "  3. Run: ngrok config add-authtoken <your-token>"
    exit 1
fi

# Check if auth token is configured
if ! ngrok config check &> /dev/null; then
    echo "Warning: ngrok may not be configured."
    echo "If this fails, run: ngrok config add-authtoken <your-token>"
    echo ""
fi

echo "Once running, use the 'Forwarding' URL for your webhook."
echo "Example: https://abc123.ngrok.io/api/webhooks/teamwork"
echo ""
echo "Press Ctrl+C to stop the tunnel."
echo "=============================================="
echo ""

# Start ngrok with JSON output to capture URL
ngrok http $PORT
