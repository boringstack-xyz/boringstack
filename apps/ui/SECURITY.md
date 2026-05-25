# Security

The merge gate (`pnpm validate`) is the first line of defense. This document
covers what _can't_ be enforced by lint and what production deployers must
verify.

## Enforced at lint time

| Surface     | Rule                                                                | Plugin                  |
| ----------- | ------------------------------------------------------------------- | ----------------------- |
| Env vars    | Only `src/lib/env/` may read `import.meta.env`                      | `env-access`            |
| Logging     | `logger.*({ event, ... })`, PII auto-redacted, no `console.*`       | `structured-logging`    |
| Auth tokens | Stored only by the API (HTTP-only cookies). UI never persists them. | code review             |
| API calls   | Only `@/lib/api/client.ts` may call `fetch`                         | `no-restricted-imports` |
| Type safety | `any`/`!`/`as` banned                                               | `typescript-eslint`     |
| XSS         | `dangerouslySetInnerHTML` is grep-banned                            | `lint:meta`             |

## Enforced at CI

Three blocking workflows run on every push to `main`, every PR, and on a
weekly cron (Monday morning UTC, staggered by minute). All upload SARIF
to GitHub Code Scanning.

| Workflow           | Scanner                                         | Allowlist              |
| ------------------ | ----------------------------------------------- | ---------------------- |
| `security-secrets` | gitleaks CLI (pinned by SHA)                    | `.gitleaksignore`      |
| `security-deps`    | `osv-scanner` + `pnpm audit --audit-level high` | `osv-scanner.toml`     |
| `security-sast`    | Semgrep — OWASP + JS packs + `.semgrep/` rules  | inline `// nosemgrep:` |

Every accepted-risk suppression has a written reason and an `ignoreUntil`
date. Suppressions are temporary by default — when the date passes, CI
fails. The weekly cron exists so this surfaces even when no one pushes.

## Repo settings hardening

The `main` branch on every BoringStack template repo enforces:

- Signed commits (configure local signing before pushing)
- Linear history (squash-merges only)
- All security workflows blocking on PR
- No force-push, no deletion

Repo-level settings (secret scanning, push protection, Dependabot
security updates, merge prefs) are described in
`.github/desired-repo-settings.json`. The `scripts/ci/audit-repo-settings.sh`
script diffs that against the live GitHub API and prints copy-pasteable
fix commands — no auto-apply.

## Agent-driven review

`.claude/settings.json` declares the Trail of Bits and Ghost Security
plugin marketplaces. The `/security-review` skill at
`.claude/skills/security-review.md` orchestrates them and adds
ui-template invariants:

- No raw `fetch` outside `@/lib/api/client.ts`
- No `dangerouslySetInnerHTML`
- No `import.meta.env` outside `src/lib/env/`
- No localStorage token storage
- CSRF and content-type validation on user-upload flows

See `AGENTS.md` → §14 "CI security gates" + §15 "Security skill set" for
the full reference.

## Runtime hardening

### CSP and security headers

All security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy) are set by **Traefik** in front of the
SPA — not by `nginx.conf` in this repo. The single source of truth is
`infra-docker-compose-template/compose/docker-compose.production-labels.yml`.

The default CSP sent on every SPA response is:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
upgrade-insecure-requests;
```

`connect-src` is `'self'` plus `https:` for compatibility with the
`https://api.example.com`-style cross-origin deployments. For
production-locked deploys (BoringStack's default same-origin path routing),
narrow it to `'self'` and your exact observability origin.

If you host the SPA on Cloudflare Pages instead (no Traefik), recreate the
header set with a `_headers` file in this directory.

### Auth flow

- Tokens are HTTP-only cookies set by the API. Never readable from JS.
- UI calls send `credentials: "include"`.
- Logout clears the React Query cache via `qc.clear()` so cached PII can't
  surface after sign-out.
- `<ProtectedRoute>` redirects with `state: { from }` so deep links resume
  after login.

### OAuth (when added)

- PKCE state + code_verifier helpers go in `src/lib/auth/pkce.ts`.
- The `state` and `code_verifier` are stored only in `sessionStorage` under
  the namespaced key, and removed on consumption.
- Validate `state` matches before exchanging the code.

### Dependency hygiene

- `dependencies` and `devDependencies` are pinned exactly (no `^`).
  Enforced by the `package-json-exact-deps` lint rule.
- `peerDependencies` use `^`. Enforced by the same rule.
- 3rd-party GitHub Actions are pinned by full commit SHA. Enforced by
  `github-actions-permissions`.
- `pnpm audit --audit-level high` runs in CI on every PR.

### Sentry source maps

Production stack traces need source maps to be useful. The
`@sentry/vite-plugin` is wired in `vite.config.ts` and uploads them only
when **all three** secrets are present at build time:

| Env var                       | Where to set it                                      |
| ----------------------------- | ---------------------------------------------------- |
| `SENTRY_AUTH_TOKEN`           | GitHub Actions secret (Settings → Secrets → Actions) |
| `SENTRY_ORG`                  | same                                                 |
| `SENTRY_PROJECT`              | same                                                 |
| `SENTRY_RELEASE` _(optional)_ | falls back to `GITHUB_SHA`                           |

Uploads run only in CI, or when `SENTRY_UPLOAD_SOURCE_MAPS=true` is set
explicitly. When any required value is missing the plugin is a no-op and source
maps are not generated — local dev and PR forks stay fast. After upload the
plugin deletes the `.map` files from `dist/` so users never see them.

**Token scoping:** generate the auth token with only
`project:releases` + `org:read` permissions. Do not reuse a personal token.

## Production checklist

Before going live:

- [ ] `VITE_SENTRY_DSN` set to the production project (browser DSN)
- [ ] `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` set in CI for source-map upload
- [ ] `VITE_PUBLIC_URL` matches the deploy URL (used for OAuth redirects, SEO)
- [ ] OAuth providers configured on the API (`GOOGLE_OAUTH_*`, `GITHUB_OAUTH_*`, `LINKEDIN_OAUTH_*`) — UI reads availability from `/api/v1/capabilities/`
- [ ] CSP `connect-src` is tightened from `https:` to your exact API/Sentry origins if your deploy allows it
- [ ] CSP matches all 3rd parties you embed (Stripe, Hotjar, etc.)
- [ ] `Strict-Transport-Security: preload` only after the domain is
      submitted to hstspreload.org and verified
- [ ] CI green on `pnpm validate` for the branch being deployed
- [ ] Lighthouse a11y ≥ 90 on the production build
- [ ] Source maps uploaded to Sentry (not served to the public)
- [ ] Cookies set by the API are `Secure`, `HttpOnly`, `SameSite=Strict`

## Reporting

Security issues: email `security@example.com`. Please do not file a public issue.
