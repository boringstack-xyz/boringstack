# Security

Defense-in-depth defaults are baked in — this doc lists what's enforced
and the production checklist.

## Enforced at boot

- `src/config/env/` validates every var. Process refuses to start if
  `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `FRONTEND_URL`, the
  email-provider key matching `EMAIL_PROVIDER`, complete OAuth credential
  pairs, or Stripe secret/webhook/price IDs (when `BILLING_ENABLED`) are
  missing.
- Production Valkey-backed features (queues, Valkey cache, SSE, OAuth
  state) require `VALKEY_PASSWORD`.
- `ALLOWED_ORIGINS` is **optional**. Empty = same-origin deployment
  (BoringStack's default) and CORS is not mounted. When set in
  production, every entry must be HTTPS with no wildcards.
- ESLint blocks `process.env.X` outside `src/config/env/**` and
  catches typos against the schema (`env-access` plugin).

## Enforced at lint time

| Surface | Plugin |
| --- | --- |
| Auth cookies set `httpOnly` + `secure`; bcrypt ≥ 12 rounds | `jwt-cookies` |
| OAuth state in Valkey (not cookies); PKCE for OIDC; bounded TTL | `oauth-security` |
| Stripe webhooks verify signature, no parsed body before verify, idempotent | `stripe-webhooks` |
| No PII (`email`, `token`, `password`, ...) in logger payloads | `structured-logging/mask-pii-fields` |
| No PII in audit-log `metadata` | `audit-log/audit-metadata-no-pii` |
| Multi-step DB writes are transactional | `db-transactions` |

## Enforced at CI

Three blocking workflows run on every push to `main`, every PR, and on a
weekly cron (Monday morning UTC, staggered by minute). All upload SARIF
to GitHub Code Scanning.

| Workflow | Scanner | Allowlist |
| --- | --- | --- |
| `security-secrets` | gitleaks CLI (pinned by SHA) | `.gitleaksignore` |
| `security-deps` | `osv-scanner` + `bun audit --audit-level=high` | `osv-scanner.toml` |
| `security-sast` | Semgrep — OWASP + JS packs + `.semgrep/` rules | inline `// nosemgrep:` |

Every accepted-risk suppression has a written reason and an `ignoreUntil`
date. Suppressions are temporary by default — when the date passes, CI
fails. The weekly cron exists so this surfaces even when no one pushes.

## Repo settings hardening

The `main` branch on every BoringStack template repo enforces:

- Signed commits (configure your local signing before pushing)
- Linear history (squash-merges only)
- All security workflows blocking on PR
- No force-push, no deletion
- Conversations must resolve before merge

Repo-level settings (secret scanning, push protection, Dependabot
security updates, merge prefs) are described in
`.github/desired-repo-settings.json`. The `scripts/ci/audit-repo-settings.sh`
script diffs that against the live GitHub API and prints copy-pasteable
fix commands — no auto-apply.

## Agent-driven review

`.claude/settings.json` declares the Trail of Bits and Ghost Security
plugin marketplaces. The `/security-review` skill at
`.claude/skills/security-review.md` orchestrates those generic skills and
adds BoringStack invariants:

- ACL coverage on every account-scoped table
- Stripe webhook idempotency on `stripe_event_id`
- Multi-tenant `accountId` scoping on every route handler
- Rate limits on credential routes
- Audit-log entries on every mutation
- BullMQ jobs idempotent under retry

See `AGENTS.md` → "Security skill set" for the full skill reference.

## Runtime hardening

- **Security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy,
  Referrer-Policy, X-Content-Type-Options)** — set by **Traefik** in
  front of the api, not by the api itself. The single source of truth
  is `infra-docker-compose-template/compose/docker-compose.production-labels.yml`.
  Running the api standalone (no Traefik in front) leaves it without
  these headers — front it with Traefik or your own reverse proxy.
- **CORS** — gated on `ALLOWED_ORIGINS`. Empty (default) = not mounted
  (same-origin via Traefik path routing). Cross-origin deployments set
  this with HTTPS origins.
- **Rate limit** — per-IP via `elysia-rate-limit`. Defense in depth on
  top of Traefik's edge rate limit.
- **Auth** — short-lived JWT (15 min) + opaque refresh session
  (30 days, rotated on use, hashed at rest) in HTTP-only cookies
  (`secure`, `sameSite: strict` in prod). Refresh tokens are
  family-tracked: presenting an already-rotated token revokes the entire
  rotation chain and writes an `auth.refresh_replay` audit event, so a
  leaked token can be reused at most once before the family is killed.
  Verification and reset tokens are opaque, hashed at rest, bounded by
  TTL, and single-use.
  Forgot-password / resend-verification responses don't leak whether an
  email is registered.

  **Access-token revocation window.** Access JWTs are stateless and
  valid until they expire. After logout or password reset, the session
  row is deleted (so refresh fails immediately), but any access JWT
  already in flight stays valid for up to 15 minutes. This is a
  deliberate trade-off — server-side checks on every request would
  defeat the point of JWT. For higher-stakes flows, gate them on a
  fresh-login challenge instead of trusting the cookie alone.
- **Idempotency** — Stripe webhooks dedup on `stripe_event_id`
  (at-least-once delivery from an external service). User-facing
  mutations rely on natural idempotency instead of an
  `Idempotency-Key` header + dedup table:
  - `POST /notifications/mark-all-read` filters on `status='unread'`,
    so a replay updates zero rows and skips the audit write.
  - `POST /auth/reset-password` deletes the reset-token row inside
    the same transaction as the password update, so the token is
    single-use; a replay 400s with "Invalid or expired reset token,"
    which is the correct outcome.

  Adding an `Idempotency-Key` header is only warranted for new
  endpoints that (a) charge money or (b) are invoked by external
  systems with retry semantics.
- **Logging** — `requestId` per request; sensitive query params
  (`token`, `password`, `secret`, `key`, `auth`, `code`, `state`, ...)
  redacted in every environment.
- **DB** — pool capped (20 prod / 10 dev), TLS verification on in prod
  by default, prepared statements enabled.
- **Container** — `Dockerfile.prod` is multi-stage, runs as UID 1001,
  wraps in `dumb-init`, healthcheck on `/health`. Compose binds prod
  ports to `127.0.0.1` (front with a reverse proxy).

## Production checklist

- [ ] `JWT_SECRET` freshly generated, ≥32 chars
- [ ] `ALLOWED_ORIGINS` — leave empty for same-origin (default); when
      set, real HTTPS hosts only, no wildcards
- [ ] `POSTGRES_PASSWORD` strong + unique
- [ ] DB backups scheduled
- [ ] Logs shipped somewhere queryable
- [ ] HTTPS terminated by reverse proxy / ingress
- [ ] Stripe webhook URL registered with matching `STRIPE_WEBHOOK_SECRET`
- [ ] Email sender domain has SPF / DKIM / DMARC

## Reporting

This is a template — vulnerability reports go to the project that
instantiates it. Replace this section with your own contact when you
spawn from this repo.
