# Image update detection (WUD)

[**WUD (What's Up Docker)**](https://getwud.github.io/wud/) watches running containers. In prod (`STACK=prod`, `WITH_WUD=1` by default) it polls GHCR for new `api` and `ui` tags. By default it is **notify-only** — Discord/Slack messages, no auto-redeploy. Flip `WUD_TRIGGER_DOCKER_APP_AUTO=true` once you have notifications wired and a tested rollback path; then WUD auto pull+recreates on every new tag.

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
3. Discord/Slack notification fires (when configured).
4. **Notify-only mode (default)** — operator decides when to apply. Pull + recreate manually:
   ```bash
   STACK=prod ./scripts/compose-up.sh pull
   STACK=prod ./scripts/compose-up.sh up -d
   ```
5. **Auto mode** (`WUD_TRIGGER_DOCKER_APP_AUTO=true`) — WUD pulls and recreates the `api` / `ui` containers automatically via the `docker.app` trigger. Skips step 4.

Base images (Postgres, Valkey, Traefik) are not auto-updated — pin and bump those manually.

## When to flip to auto mode

Auto-redeploy on every main push has no canary, no health check, and no rollback automation. Stay in notify-only until:

- Notifications go somewhere a human reads within a few hours.
- A rollback runbook exists (set `API_IMAGE_TAG` to the prior `sha-<7>` and re-up).
- Health checks (`/health`, `/ready`) are alerted on (see `prometheus/rules.yml`).
- The product has a tested incident response — even if "tested" is "I did one rehearsal."

Without those, instant redeploy of bad code is a footgun.

## Costs / footprint

- Memory limit: 256M (`WUD_LIMITS_MEMORY`).
- Docker socket is read-write (required for auto pull+recreate).
- Registry polling default: every 6h.

## Disable

```bash
WITH_WUD=0 STACK=prod ./scripts/compose-up.sh
```

Related: [security-hardening.md](security-hardening.md)
