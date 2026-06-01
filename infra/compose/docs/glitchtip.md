# GlitchTip — self-hosted error tracking

GlitchTip is an open-source, Sentry-compatible error tracking platform. It speaks the Sentry SDK wire protocol, so any client library (`@sentry/react`, `@sentry/node`, `sentry-elysia`, etc.) just works — you point its DSN at your GlitchTip instance instead of `sentry.io`.

GlitchTip is **on by default** for `dev` and `prod` via `./dev.sh up`. It reuses the base stack's Postgres and Valkey, so the cost is just two extra containers (`web` + `worker`). Opt out with `WITH_GLITCHTIP=0`.

The premise: same as the rest of the observability stack — you should see your own errors land in your own GlitchTip during development. By the time prod throws its first exception, the triage flow is muscle memory.

## Dev quickstart

```bash
./scripts/compose-up.sh        # GlitchTip is on by default
```

That's it. `dev.sh` auto-seeds a dev-only `GLITCHTIP_SECRET_KEY` if you don't set one. On a fresh boot the GlitchTip image entrypoint:
- runs Django migrations against the `glitchtip` database (created by `compose/glitchtip/init-db.sql`)
- creates the superuser `admin@localhost` / `admin123456` (override via `GLITCHTIP_SUPERUSER_*` in `.env`)
- creates a default organization (`Local`) with two projects (`API`, `Frontend`)

**DSNs are auto-wired.** `dev.sh up -d` runs `scripts/glitchtip-fetch-dsn.sh` in the background once GlitchTip is up. The script reads the DSNs for the `API` and `Frontend` projects from GlitchTip's Django ORM, writes them to `compose/.env` as `SENTRY_DSN` and `VITE_SENTRY_DSN`, and restarts `api-dev` + `ui-dev` so they pick the values up. Re-runs are idempotent — the script exits silently when the wiring already matches.

Visit **http://glitchtip.localhost** to log in if you want to browse events, configure alerts, or rotate the superuser password. The DSN copy-paste step from older docs is gone.

If you'd rather point at hosted Sentry or a different GlitchTip, set `SENTRY_DSN` / `VITE_SENTRY_DSN` manually in `compose/.env` before `up`. The script only writes when the .env value is empty — any non-empty value is treated as deliberate and left alone. To rewire after wiping the GlitchTip Postgres volume, clear those two lines and re-run `./scripts/glitchtip-fetch-dsn.sh`.

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
3. Bring up the stack (GlitchTip is on by default; the prod path requires the secrets above and will fail loudly if any are unset):
   ```bash
   STACK=prod ./scripts/compose-up.sh
   ```
4. Run the bootstrap script once:
   ```bash
   ./scripts/glitchtip-bootstrap.sh
   ```
   (Migrations + superuser creation. Re-running is safe.)

The `/api/*` router has **no Basic Auth** so client SDKs can POST events without credentials (they authenticate via the project DSN in the request body). The UI router (`/*`) requires Basic Auth, which gates the dashboard from the public internet.

## SDK integration

The SDKs are already wired in both apps; the auto-wire above gives them DSNs to talk to.

**API (apps/api)** — `@sentry/bun` is initialised in `apps/api/src/config/sentry/sentry.ts`. Reads `SENTRY_DSN` from env; no-op when empty. `tracesSampleRate` defaults to `0` (env-tunable via `SENTRY_TRACES_SAMPLE_RATE`) — OTel ships traces to Tempo, Sentry stays error-capture-only.

**UI (apps/ui)** — `@sentry/react` is initialised in `apps/ui/src/app/main.tsx`. Reads `VITE_SENTRY_DSN` at dev-server start (or build time for the prod bundle); no-op when empty. Same posture: `tracesSampleRate: 0`, error capture only, trace IDs propagate via `browserTracingIntegration` so server-side spans land in Tempo with the same ID.

## Verifying ingestion

After SDK setup, trigger a test error:
```bash
# In the API:
docker compose exec api-dev bun -e 'throw new Error("test from apps/api")'
```

The error should appear in GlitchTip within a few seconds under the `API` project. If not:
- Check `docker compose logs glitchtip-worker` for ingest errors.
- Check the SDK is actually loaded (the API's `/health` response includes Sentry init status).
- Check the DSN's domain matches `GLITCHTIP_DOMAIN`.

## Rotating the dev superuser

After first boot, change the password from the GlitchTip UI (`Profile → Change Password`). The `GLITCHTIP_SUPERUSER_PASSWORD` env is only consulted when the user doesn't exist — your in-DB password is the source of truth thereafter.
