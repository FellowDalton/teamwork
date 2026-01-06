Start ngrok tunnel for Teamwork webhook development.

```bash
ngrok http 3001 > /dev/null 2>&1 & sleep 3 && curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 | xargs -I{} echo "{}/api/webhooks/teamwork"
```

Configure in Teamwork: **Settings → Integrations → Webhooks → Add Webhook**

Stop tunnel: `pkill -f ngrok`
