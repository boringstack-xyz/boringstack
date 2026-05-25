# GlitchTip — self-hosted error tracking

GlitchTip is an open-source, Sentry-compatible error tracking platform. It speaks the Sentry SDK wire protocol, so any client library (`@sentry/react`, `@sentry/node`, `sentry-elysia`, etc.) just works — you point its DSN at your GlitchTip instance instead of `sentry.io`.

This template ships GlitchTip as an **optional overlay** that reuses the base stack's Postgres and Valkey, so the cost of having it on is just the two GlitchTip containers (`web` + `worker`).

## Dev quickstart

```bash
# 1. Set the required secret in compose/.env:
echo "GLITCHTIP_SECRET_KEY=$(openssl rand -base64 50)" >> compose/.env

# 2. Bring the stack up with the overlay:
WITH_GLITCHTIP=1 ./scripts/compose-up.sh
```

That's it. On a fresh boot the GlitchTip image entrypoint:
- runs Django migrations against the `glitchtip` database (created by `compose/glitchtip/init-db.sql`)
- creates the superuser `admin@localhost` / `admin123456` (override via `GLITCHTIP_SUPERUSER_*` in `.env`)
- creates a default organization (`Local`) with two projects (`API`, `Frontend`)

Visit **http://glitchtip.localhost** and log in. Each project has a DSN under `Settings → Client Keys`. Copy them into the api-template's `.env` (as `SENTRY_DSN`) and the ui-template's `.env.local` (as `VITE_SENTRY_DSN`).

## How it's wired

| Concern | Source |
|---|---|
| Database | shared Postgres, separate `glitchtip` database (created by `init-db.sql` on first postgres boot) |
| Queue / cache | shared Valkey, **DB 1** (the API uses DB 0) |
| Routing (dev) | Traefik HTTP at `glitchtip.localhost` |
| Routing (prod) | Two HTTPS routers: `/api/*` (no auth, CORS open — for SDK ingest), `/*` (Basic Auth — for the UI) |
| Worker | `glitchtip-worker` runs Celery + Beat for ingest, alerts, and scheduled jobs |
| Email | `consolemail://` by default in dev; set `GLITCHTIP_EMAIL_URL=smtp://...` for prod |

## Prod setup

1. Set required env vars in `compose/.env`:
   ```env
   GLITCHTIP_SECRET_KEY=...                                   # openssl rand -base64 50
   GLITCHTIP_DOMAIN=https://glitchtip.example.com
   GLITCHTIP_PUBLIC_HOST=glitchtip.example.com                # public DNS name for ACME
   GLITCHTIP_BASIC_AUTH_USERS=admin:$$apr1$$...               # htpasswd -nb admin pass (escape $ → $$)
   GLITCHTIP_EMAIL_URL=smtp://user:pass@smtp.example.com:587
   GLITCHTIP_SUPERUSER_EMAIL=ops@example.com
   GLITCHTIP_SUPERUSER_PASSWORD=...                           # rotate the dev default
   ```
2. Point DNS `glitchtip.example.com` at the host.
3. Bring up the stack:
   ```bash
   STACK=prod WITH_GLITCHTIP=1 ./scripts/compose-up.sh
   ```
4. Run the bootstrap script once:
   ```bash
   ./scripts/glitchtip-bootstrap.sh
   ```
   (Migrations + superuser creation. Re-running is safe.)

The `/api/*` router has **no Basic Auth** so client SDKs can POST events without credentials (they authenticate via the project DSN in the request body). The UI router (`/*`) requires Basic Auth, which gates the dashboard from the public internet.

## SDK integration

**API (api-template)** — `bun add @sentry/bun` (or use the api-template's existing Sentry middleware):
```ts
import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: process.env.SENTRY_DSN,           // from GlitchTip → Project → Client Keys
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

**UI (ui-template)** — uses `@sentry/react` and reads `VITE_SENTRY_DSN` from `src/lib/env`. Just set the DSN; the existing wiring sends events to whichever endpoint that DSN points at.

## Verifying ingestion

After SDK setup, trigger a test error:
```bash
# In the API:
docker compose exec api-dev bun -e 'throw new Error("test from api-template")'
```

The error should appear in GlitchTip within a few seconds under the `API` project. If not:
- Check `docker compose logs glitchtip-worker` for ingest errors.
- Check the SDK is actually loaded (the API's `/health` response includes Sentry init status).
- Check the DSN's domain matches `GLITCHTIP_DOMAIN`.

## Rotating the dev superuser

After first boot, change the password from the GlitchTip UI (`Profile → Change Password`). The `GLITCHTIP_SUPERUSER_PASSWORD` env is only consulted when the user doesn't exist — your in-DB password is the source of truth thereafter.
