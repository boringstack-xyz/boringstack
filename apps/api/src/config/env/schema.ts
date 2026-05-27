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
   * Error tracking — Sentry-compatible. Point at GlitchTip's project DSN for
   * self-hosted (see infra/compose/docs/glitchtip.md) or at
   * sentry.io for hosted. Empty DSN = Sentry is not initialized.
   */
  SENTRY_DSN: t.String({ default: "" }),
  SENTRY_TRACES_SAMPLE_RATE: t.Number({
    minimum: 0,
    maximum: 1,
    default: 0.1,
  }),

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
  SENDGRID_API_KEY: t.String({ default: "" }),
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

  QUEUES_ENABLED: t.Boolean({ default: false }),
  CACHE_ENABLED: t.Boolean({ default: false }),
  CACHE_PROVIDER: t.Union([t.Literal("memory"), t.Literal("valkey")], {
    default: "memory",
  }),
  NOTIFICATIONS_SSE_ENABLED: t.Boolean({ default: false }),

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
