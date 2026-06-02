import { t } from "elysia";

/**
 * Single source of truth for the API's runtime configuration. Anything
 * that can't be expressed in pure TypeBox (cross-field invariants like
 * "STRIPE_* required when BILLING_ENABLED=true") lives in `validate.ts`.
 */
export const envSchema = t.Object({
  NODE_ENV: t.Union(
    [t.Literal("development"), t.Literal("production"), t.Literal("test")],
    { default: "development" }
  ),
  PORT: t.Integer({ minimum: 1, maximum: 65535, default: 7330 }),
  LOG_LEVEL: t.Union(
    [
      t.Literal("debug"),
      t.Literal("info"),
      t.Literal("warn"),
      t.Literal("error"),
    ],
    { default: "info" }
  ),

  DATABASE_URL: t.String({ minLength: 1 }),
  DATABASE_POOL_SIZE: t.Integer({ minimum: 1, default: 10 }),
  DATABASE_SSL_REJECT_UNAUTHORIZED: t.Boolean({ default: true }),
  DATABASE_SSL_CA: t.String({ default: "" }),
  JWT_SECRET: t.String({ minLength: 32 }),
  /*
   * Behavior of JWT revocation checks (jti blocklist, user revoke-before
   * cutoff) when the cache is unreachable. `false` (default) fails open:
   * a cache outage never blocks authentication, at the cost of honoring
   * revoked tokens until the cache returns or they expire (bounded by
   * the 15-minute JWT TTL). `true` fails closed: cache errors reject
   * every authenticated request — strict revocation semantics for
   * deployments that prefer an auth outage over a revocation gap.
   */
  JWT_REVOCATION_FAIL_CLOSED: t.Boolean({ default: false }),
  /*
   * AES-256-GCM key used to encrypt TOTP secrets at rest. Base64-encoded
   * 32 random bytes. Generate with `openssl rand -base64 32`. Required
   * once any user enables MFA — empty string is accepted at boot so a
   * fresh deploy with no MFA users keeps running, and the crypto util
   * throws a loud error the first time encryption is actually requested.
   */
  MFA_ENCRYPTION_KEY: t.String({ default: "" }),

  APP_NAME: t.String({ default: "API Template" }),
  FRONTEND_URL: t.String({ minLength: 1 }),
  /*
   * Empty array = same-origin deployment; CORS middleware is not mounted.
   * Set to a comma-separated list of allowed origins for cross-origin setups.
   */
  ALLOWED_ORIGINS: t.Array(t.String(), { default: [] }),
  PUBLIC_API_URL: t.String({ minLength: 1 }),
  NOTIFICATION_SETTINGS_URL: t.String({ default: "" }),

  /*
   * Optional first-boot superuser bootstrap. When both are set, the migrate
   * job creates this user with admin role on first run. Empty = no user
   * created; the operator signs up via the registration flow or sets these
   * and re-runs `bun run db:seed`.
   */
  SUPERUSER_EMAIL: t.String({ default: "" }),
  SUPERUSER_PASSWORD: t.String({ default: "" }),
  E2E_TEST_ENDPOINTS_ENABLED: t.Boolean({ default: false }),

  RATE_LIMIT_MAX: t.Integer({ minimum: 1, default: 100 }),
  RATE_LIMIT_WINDOW_MS: t.Integer({ minimum: 1000, default: 60_000 }),
  AUTH_RATE_LIMIT_MAX: t.Integer({ minimum: 1, default: 10 }),
  AUTH_RATE_LIMIT_WINDOW_MS: t.Integer({ minimum: 1000, default: 60_000 }),
  /*
   * When true, the rate limiter reads the leftmost IP from
   * X-Forwarded-For instead of the socket peer. Required behind any
   * reverse proxy (Traefik, nginx, Cloudflare). Spoofable without a
   * trusted proxy in front, so leave off for direct-exposed deploys.
   */
  TRUST_PROXY: t.Boolean({ default: false }),

  /*
   * Error tracking — Sentry-compatible. Point at GlitchTip's project DSN for
   * self-hosted (see infra/compose/docs/glitchtip.md) or at
   * sentry.io for hosted. Empty DSN = Sentry is not initialized.
   */
  SENTRY_DSN: t.String({ default: "" }),
  /*
   * Default 0: OTel is the single source of trace data (shipped via OTLP to
   * Tempo). Sentry is error-capture-only — events still carry `trace_id` from
   * the shared OTel context, so GlitchTip → Tempo click-through works. Flip
   * non-zero only if you want Sentry / GlitchTip to record transactions in
   * addition to errors; running both tracers concurrently double-instruments
   * HTTP / fetch / ioredis paths through `@sentry/opentelemetry`.
   */
  SENTRY_TRACES_SAMPLE_RATE: t.Number({
    minimum: 0,
    maximum: 1,
    default: 0,
  }),

  /*
   * OpenTelemetry tracing. When OTEL_EXPORTER_OTLP_ENDPOINT is set, the
   * API ships spans via OTLP/HTTP to that endpoint (Tempo, the trace
   * backend bundled in compose). Empty = OTel SDK is not initialized.
   * OTEL_SERVICE_NAME shows up as the `service.name` attribute Grafana
   * uses to group spans in Tempo's Explore tab.
   */
  OTEL_EXPORTER_OTLP_ENDPOINT: t.String({ default: "" }),
  OTEL_SERVICE_NAME: t.String({ default: "boringstack-api" }),

  EMAIL_PROVIDER: t.Union(
    [
      t.Literal("cloudflare"),
      t.Literal("resend"),
      t.Literal("sendgrid"),
      t.Literal("smtp"),
    ],
    { default: "cloudflare" }
  ),
  EMAIL_FROM: t.String({ default: "noreply@example.com" }),
  /*
   * Optional override for the precompiled templates directory. Empty
   * means "auto-resolve relative to the running module / cwd".
   */
  EMAIL_TEMPLATES_DIR: t.String({ default: "" }),
  /*
   * Cloudflare Email Service (primary). Both vars required in prod when
   * EMAIL_PROVIDER=cloudflare; see validate.ts for the invariant.
   */
  CLOUDFLARE_ACCOUNT_ID: t.String({ default: "" }),
  CLOUDFLARE_EMAIL_API_TOKEN: t.String({ default: "" }),
  RESEND_API_KEY: t.String({ default: "" }),
  /*
   * Resend webhook signing secret (svix). Required for the bounce /
   * complaint webhook at /api/v1/webhooks/resend. Format: starts with
   * `whsec_` followed by a base64 secret. Issue from the Resend
   * dashboard under Webhooks → endpoint signing secret. Empty disables
   * the route (it returns 503).
   */
  RESEND_WEBHOOK_SECRET: t.String({ default: "" }),
  SENDGRID_API_KEY: t.String({ default: "" }),
  /*
   * SendGrid Event Webhook signing key. PEM-encoded ECDSA P-256 public
   * key produced when "Signed Event Webhook Requests" is enabled in
   * Mail Settings → Event Webhook. Required for the bounce / complaint
   * webhook at /api/v1/webhooks/sendgrid. Empty disables the route.
   */
  SENDGRID_WEBHOOK_PUBLIC_KEY: t.String({ default: "" }),
  /*
   * Plain SMTP provider. Primary use case is local Mailpit at
   * mailpit:1025 (no auth) when WITH_MAILPIT=1 in the compose stack;
   * also works against any RFC-5321 server in production.
   */
  SMTP_HOST: t.String({ default: "" }),
  SMTP_PORT: t.Integer({ minimum: 1, maximum: 65535, default: 25 }),
  SMTP_USER: t.String({ default: "" }),
  SMTP_PASS: t.String({ default: "" }),

  GOOGLE_OAUTH_CLIENT_ID: t.String({ default: "" }),
  GOOGLE_OAUTH_CLIENT_SECRET: t.String({ default: "" }),
  GITHUB_OAUTH_CLIENT_ID: t.String({ default: "" }),
  GITHUB_OAUTH_CLIENT_SECRET: t.String({ default: "" }),
  LINKEDIN_OAUTH_CLIENT_ID: t.String({ default: "" }),
  LINKEDIN_OAUTH_CLIENT_SECRET: t.String({ default: "" }),

  AI_ENABLED: t.Boolean({ default: false }),
  AI_PROVIDER: t.Union(
    [t.Literal("openai"), t.Literal("anthropic"), t.Literal("noop")],
    { default: "openai" }
  ),
  OPENAI_API_KEY: t.String({ default: "" }),
  /** Override to point at any OpenAI-compatible endpoint (OpenRouter, Ollama, vLLM, etc.). */
  OPENAI_BASE_URL: t.String({ default: "" }),
  /** JSON object of extra headers, e.g. for OpenRouter ranking. */
  OPENAI_DEFAULT_HEADERS: t.String({ default: "" }),
  ANTHROPIC_API_KEY: t.String({ default: "" }),

  /*
   * Domain claiming for B2B mode. When true, the first verified signup
   * with a non-public email domain (gmail.com / outlook.com / etc. are
   * excluded) claims that domain on its personal account. Subsequent
   * signups from the same domain don't create a new account — they
   * land in a `pending` join-request state against the existing one,
   * which the account owner approves or denies.
   *
   * Off by default. Forks targeting consumer products leave it off;
   * forks targeting company workspaces flip it on at deploy time.
   */
  ACCOUNT_DOMAIN_CLAIMING: t.Boolean({ default: false }),

  BILLING_ENABLED: t.Boolean({ default: false }),
  STRIPE_SECRET_KEY: t.String({ default: "" }),
  STRIPE_WEBHOOK_SECRET: t.String({ default: "" }),
  STRIPE_PRICE_ID_FREE: t.String({ default: "" }),
  STRIPE_PRICE_ID_PRO: t.String({ default: "" }),

  QUEUES_ENABLED: t.Boolean({ default: true }),
  CACHE_ENABLED: t.Boolean({ default: true }),
  CACHE_PROVIDER: t.Union([t.Literal("memory"), t.Literal("valkey")], {
    default: "memory",
  }),
  NOTIFICATIONS_SSE_ENABLED: t.Boolean({ default: true }),

  /*
   * Web Push (VAPID). All three values come as a set: generate them once
   * via `bun run vapid:generate`. Empty values disable the channel — the
   * `web-push` channel only registers when all three are present. Subject
   * is typically `mailto:notifications@<your-domain>`. validate.ts
   * enforces the all-or-nothing invariant.
   */
  WEB_PUSH_VAPID_PUBLIC: t.String({ default: "" }),
  WEB_PUSH_VAPID_PRIVATE: t.String({ default: "" }),
  WEB_PUSH_VAPID_SUBJECT: t.String({ default: "" }),

  VALKEY_HOST: t.String({ default: "localhost" }),
  VALKEY_PORT: t.Integer({ minimum: 1, maximum: 65535, default: 6379 }),
  VALKEY_PASSWORD: t.String({ default: "" }),
  VALKEY_DB: t.Integer({ minimum: 0, default: 0 }),
});

export type Env = typeof envSchema.static;
