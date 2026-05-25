# Image update detection (WUD)

[**WUD (What's Up Docker)**](https://getwud.github.io/wud/) watches running containers. In prod (`STACK=prod`, `WITH_WUD=1` by default) it **auto pull+recreates** `api` and `ui` when GHCR publishes a new tag. Optional notifications go to Discord and/or Slack.

## Setup

1. **Optional notifications** — add to `compose/.env` (pick one or both):

   **Discord** (incoming webhook):
   ```env
   WUD_DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
   ```
   Discord → Server Settings → Integrations → Webhooks → New Webhook → copy URL.

   **Slack** (bot token + channel):
   ```env
   WUD_SLACK_BOT_TOKEN=xoxb-...
   WUD_SLACK_CHANNEL=docker-updates
   ```
   Slack → Your App → OAuth & Permissions → install to workspace → copy **Bot User OAuth Token**. Invite the bot to the channel you set in `WUD_SLACK_CHANNEL`.

2. **Private GHCR** (forks with private images):
   ```env
   WUD_GHCR_USERNAME=your-gh-username
   WUD_GHCR_TOKEN=ghp_xxx   # PAT with read:packages
   ```

3. **Schedule** (optional):
   ```env
   WUD_SCHEDULE="0 */6 * * *"   # default: every 6h
   ```

4. Boot (prod enables WUD automatically):
   ```bash
   STACK=prod ./scripts/compose-up.sh
   ```

## Where to look

- **Dashboard** — http://localhost:3033 (or `:3033` on the VPS) lists containers and available tags.
- **Discord / Slack** — when a newer tag is detected (and webhook/token configured), WUD posts an update card.

## What happens on api/ui updates

1. Release workflow publishes a new GHCR tag.
2. WUD detects the move on its cron schedule.
3. WUD pulls and recreates the `api` / `ui` containers (`docker.app` trigger).
4. Optional Discord/Slack notification fires if configured.

Base images (Postgres, Valkey, Traefik) are not auto-updated — pin and bump those manually.

## Costs / footprint

- Memory limit: 256M (`WUD_LIMITS_MEMORY`).
- Docker socket is read-write (required for auto pull+recreate).
- Registry polling default: every 6h.

## Disable

```bash
WITH_WUD=0 STACK=prod ./scripts/compose-up.sh
```

Related: [security-hardening.md](security-hardening.md)
