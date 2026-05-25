import "dotenv/config";

import { Value } from "@sinclair/typebox/value";
import { envSchema, type Env } from "./schema";

type EnvSource = Record<string, string | undefined>;

export const toInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const parsed = parseInt(raw, 10);

  return Number.isNaN(parsed) ? fallback : parsed;
};

export const toBool = (raw: string | undefined): boolean => raw === "true";

export const toFloat = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(raw);

  return Number.isNaN(parsed) ? fallback : parsed;
};

export const nonEmpty = (raw: string | undefined, fallback: string): string => {
  if (raw === undefined || raw === "") {
    return fallback;
  }

  return raw;
};

export const toCsv = (raw: string | undefined): string[] => {
  if (raw === undefined || raw === "") {
    return [];
  }

  return raw
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

/*
 * ────────────────────────────────────────────────────────────────────
 *  Per-domain readers
 *
 *  Each reader pulls its slice from `source` and coerces values. The
 *  composer (`readRaw`) spreads them all together. Cross-field
 *  invariants run later, against the TypeBox-validated object.
 * ────────────────────────────────────────────────────────────────────
 */

const readCore = (source: EnvSource) => ({
  NODE_ENV: source.NODE_ENV ?? "development",
  PORT: toInt(source.PORT, 3000),
  LOG_LEVEL: source.LOG_LEVEL ?? "info",
  APP_NAME: source.APP_NAME ?? "API Template",
});

const readDatabase = (source: EnvSource) => ({
  DATABASE_URL: nonEmpty(
    source.DATABASE_URL,
    source.NODE_ENV === "test" ? "postgresql://test:test@127.0.0.1:1/test" : ""
  ),
  DATABASE_POOL_SIZE: toInt(source.DATABASE_POOL_SIZE, 10),
  DATABASE_SSL_REJECT_UNAUTHORIZED:
    source.DATABASE_SSL_REJECT_UNAUTHORIZED === undefined
      ? true
      : toBool(source.DATABASE_SSL_REJECT_UNAUTHORIZED),
  DATABASE_SSL_CA: source.DATABASE_SSL_CA ?? "",
});

const readAuth = (source: EnvSource) => ({
  JWT_SECRET: nonEmpty(
    source.JWT_SECRET,
    source.NODE_ENV === "test"
      ? "test-only-jwt-secret-padded-to-thirty-two-chars"
      : ""
  ),
  SUPERUSER_EMAIL: source.SUPERUSER_EMAIL ?? "",
  SUPERUSER_PASSWORD: source.SUPERUSER_PASSWORD ?? "",
  E2E_TEST_ENDPOINTS_ENABLED: toBool(source.E2E_TEST_ENDPOINTS_ENABLED),
});

const readUrls = (source: EnvSource) => ({
  FRONTEND_URL: nonEmpty(
    source.FRONTEND_URL,
    source.NODE_ENV === "test" ? "http://localhost:5173" : ""
  ),
  ALLOWED_ORIGINS: toCsv(source.ALLOWED_ORIGINS),
  PUBLIC_API_URL:
    source.PUBLIC_API_URL ??
    `http://localhost:${String(toInt(source.PORT, 3000))}`,
  NOTIFICATION_SETTINGS_URL: source.NOTIFICATION_SETTINGS_URL ?? "",
});

const readRateLimit = (source: EnvSource) => ({
  RATE_LIMIT_MAX: toInt(source.RATE_LIMIT_MAX, 100),
  RATE_LIMIT_WINDOW_MS: toInt(source.RATE_LIMIT_WINDOW_MS, 60_000),
  AUTH_RATE_LIMIT_MAX: toInt(source.AUTH_RATE_LIMIT_MAX, 10),
  AUTH_RATE_LIMIT_WINDOW_MS: toInt(source.AUTH_RATE_LIMIT_WINDOW_MS, 60_000),
});

const readSentry = (source: EnvSource) => ({
  SENTRY_DSN: source.SENTRY_DSN ?? "",
  SENTRY_TRACES_SAMPLE_RATE: toFloat(source.SENTRY_TRACES_SAMPLE_RATE, 0.1),
});

const readEmail = (source: EnvSource) => ({
  EMAIL_PROVIDER: source.EMAIL_PROVIDER ?? "cloudflare",
  EMAIL_FROM: source.EMAIL_FROM ?? "noreply@example.com",
  EMAIL_TEMPLATES_DIR: source.EMAIL_TEMPLATES_DIR ?? "",
  CLOUDFLARE_ACCOUNT_ID: source.CLOUDFLARE_ACCOUNT_ID ?? "",
  CLOUDFLARE_EMAIL_API_TOKEN: source.CLOUDFLARE_EMAIL_API_TOKEN ?? "",
  RESEND_API_KEY: source.RESEND_API_KEY ?? "",
  SENDGRID_API_KEY: source.SENDGRID_API_KEY ?? "",
  SMTP_HOST: source.SMTP_HOST ?? "",
  SMTP_PORT: toInt(source.SMTP_PORT, 25),
  SMTP_USER: source.SMTP_USER ?? "",
  SMTP_PASS: source.SMTP_PASS ?? "",
});

const readOAuth = (source: EnvSource) => ({
  GOOGLE_OAUTH_CLIENT_ID: source.GOOGLE_OAUTH_CLIENT_ID ?? "",
  GOOGLE_OAUTH_CLIENT_SECRET: source.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
  GITHUB_OAUTH_CLIENT_ID: source.GITHUB_OAUTH_CLIENT_ID ?? "",
  GITHUB_OAUTH_CLIENT_SECRET: source.GITHUB_OAUTH_CLIENT_SECRET ?? "",
  LINKEDIN_OAUTH_CLIENT_ID: source.LINKEDIN_OAUTH_CLIENT_ID ?? "",
  LINKEDIN_OAUTH_CLIENT_SECRET: source.LINKEDIN_OAUTH_CLIENT_SECRET ?? "",
});

const readAI = (source: EnvSource) => ({
  AI_ENABLED: toBool(source.AI_ENABLED),
  AI_PROVIDER: source.AI_PROVIDER ?? "openai",
  OPENAI_API_KEY: source.OPENAI_API_KEY ?? "",
  OPENAI_BASE_URL: source.OPENAI_BASE_URL ?? "",
  OPENAI_DEFAULT_HEADERS: source.OPENAI_DEFAULT_HEADERS ?? "",
  ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY ?? "",
});

const readMultiTenant = (source: EnvSource) => ({
  ACCOUNT_DOMAIN_CLAIMING: toBool(source.ACCOUNT_DOMAIN_CLAIMING),
});

const readBilling = (source: EnvSource) => ({
  BILLING_ENABLED: toBool(source.BILLING_ENABLED),
  STRIPE_SECRET_KEY: source.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: source.STRIPE_WEBHOOK_SECRET ?? "",
  STRIPE_PRICE_ID_FREE: source.STRIPE_PRICE_ID_FREE ?? "",
  STRIPE_PRICE_ID_PRO: source.STRIPE_PRICE_ID_PRO ?? "",
});

const readBackground = (source: EnvSource) => ({
  QUEUES_ENABLED: toBool(source.QUEUES_ENABLED),
  CACHE_ENABLED: toBool(source.CACHE_ENABLED),
  CACHE_PROVIDER: source.CACHE_PROVIDER ?? "memory",
  NOTIFICATIONS_SSE_ENABLED: toBool(source.NOTIFICATIONS_SSE_ENABLED),
});

const readWebPush = (source: EnvSource) => ({
  WEB_PUSH_VAPID_PUBLIC: source.WEB_PUSH_VAPID_PUBLIC ?? "",
  WEB_PUSH_VAPID_PRIVATE: source.WEB_PUSH_VAPID_PRIVATE ?? "",
  WEB_PUSH_VAPID_SUBJECT: source.WEB_PUSH_VAPID_SUBJECT ?? "",
});

const readValkey = (source: EnvSource) => ({
  VALKEY_HOST: source.VALKEY_HOST ?? "localhost",
  VALKEY_PORT: toInt(source.VALKEY_PORT, 6379),
  VALKEY_PASSWORD: source.VALKEY_PASSWORD ?? "",
  VALKEY_DB: toInt(source.VALKEY_DB, 0),
});

const readRaw = (source: EnvSource): Record<string, unknown> => ({
  ...readCore(source),
  ...readDatabase(source),
  ...readAuth(source),
  ...readUrls(source),
  ...readRateLimit(source),
  ...readSentry(source),
  ...readEmail(source),
  ...readOAuth(source),
  ...readAI(source),
  ...readMultiTenant(source),
  ...readBilling(source),
  ...readBackground(source),
  ...readWebPush(source),
  ...readValkey(source),
});

/*
 * ────────────────────────────────────────────────────────────────────
 *  Cross-field invariants
 *
 *  Anything that can't be expressed in pure TypeBox lives here, so
 *  error messages stay specific (e.g. "STRIPE_* required when billing
 *  on") instead of generic schema noise.
 * ────────────────────────────────────────────────────────────────────
 */

const checkHttpUrl = (value: string, name: string): string[] => {
  try {
    const parsed = new URL(value);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";

    return isHttp ? [] : [`${name} must be an http(s) URL`];
  } catch {
    return [`${name} must be a valid URL`];
  }
};

const checkUrls = (env: Env): string[] => [
  ...checkHttpUrl(env.FRONTEND_URL, "FRONTEND_URL"),
  ...checkHttpUrl(env.PUBLIC_API_URL, "PUBLIC_API_URL"),
  ...(env.NOTIFICATION_SETTINGS_URL === ""
    ? []
    : checkHttpUrl(env.NOTIFICATION_SETTINGS_URL, "NOTIFICATION_SETTINGS_URL")),
];

const checkOrigins = (env: Env): string[] => {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  /*
   * Empty ALLOWED_ORIGINS is valid in production: it signals a same-origin
   * deployment (BoringStack's default — Traefik path-routes /api/* on the
   * same host that serves the SPA). The CORS middleware is then not mounted.
   * If it IS set, every entry must be HTTPS and not a wildcard.
   */
  if (env.ALLOWED_ORIGINS.length === 0) {
    return [];
  }

  const hasInvalid = env.ALLOWED_ORIGINS.some((origin) => {
    if (origin.includes("*")) {
      return true;
    }

    try {
      return new URL(origin).protocol !== "https:";
    } catch {
      return true;
    }
  });

  return hasInvalid
    ? ["Production ALLOWED_ORIGINS must be HTTPS, no wildcards"]
    : [];
};

const checkEmailProvider = (env: Env): string[] => {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  // Cloudflare Email Service needs an account-scoped endpoint AND a token.
  if (env.EMAIL_PROVIDER === "cloudflare") {
    if (
      env.CLOUDFLARE_ACCOUNT_ID === "" ||
      env.CLOUDFLARE_EMAIL_API_TOKEN === ""
    ) {
      return [
        "Email provider 'cloudflare' requires both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN",
      ];
    }

    return [];
  }

  // SMTP just needs a host; auth is optional (Mailpit accepts any).
  if (env.EMAIL_PROVIDER === "smtp") {
    return env.SMTP_HOST === ""
      ? ["Email provider 'smtp' requires SMTP_HOST"]
      : [];
  }

  const keyByProvider: Record<"resend" | "sendgrid", string> = {
    resend: env.RESEND_API_KEY,
    sendgrid: env.SENDGRID_API_KEY,
  };

  if (keyByProvider[env.EMAIL_PROVIDER] === "") {
    return [
      `Email provider '${env.EMAIL_PROVIDER}' selected but its API key is missing`,
    ];
  }

  return [];
};

const checkAIProvider = (env: Env): string[] => {
  if (!env.AI_ENABLED || env.NODE_ENV === "test") {
    return [];
  }

  if (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY === "") {
    return [
      "AI_ENABLED=true with AI_PROVIDER=openai requires OPENAI_API_KEY (works for OpenAI, OpenRouter, Ollama via OPENAI_BASE_URL)",
    ];
  }

  if (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY === "") {
    return [
      "AI_ENABLED=true with AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY",
    ];
  }

  return [];
};

const checkBilling = (env: Env): string[] => {
  if (!env.BILLING_ENABLED || env.NODE_ENV === "test") {
    return [];
  }

  const errors: string[] = [];

  if (env.STRIPE_SECRET_KEY === "") {
    errors.push("STRIPE_SECRET_KEY required when BILLING_ENABLED=true");
  }

  if (env.STRIPE_WEBHOOK_SECRET === "") {
    errors.push("STRIPE_WEBHOOK_SECRET required when BILLING_ENABLED=true");
  }

  if (env.STRIPE_PRICE_ID_FREE === "") {
    errors.push("STRIPE_PRICE_ID_FREE required when BILLING_ENABLED=true");
  }

  if (env.STRIPE_PRICE_ID_PRO === "") {
    errors.push("STRIPE_PRICE_ID_PRO required when BILLING_ENABLED=true");
  }

  return errors;
};

const hasOAuthProvider = (env: Env): boolean =>
  (env.GOOGLE_OAUTH_CLIENT_ID !== "" &&
    env.GOOGLE_OAUTH_CLIENT_SECRET !== "") ||
  (env.GITHUB_OAUTH_CLIENT_ID !== "" &&
    env.GITHUB_OAUTH_CLIENT_SECRET !== "") ||
  (env.LINKEDIN_OAUTH_CLIENT_ID !== "" &&
    env.LINKEDIN_OAUTH_CLIENT_SECRET !== "");

const checkOAuth = (env: Env): string[] => {
  const pairs = [
    {
      name: "Google",
      id: env.GOOGLE_OAUTH_CLIENT_ID,
      secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    },
    {
      name: "GitHub",
      id: env.GITHUB_OAUTH_CLIENT_ID,
      secret: env.GITHUB_OAUTH_CLIENT_SECRET,
    },
    {
      name: "LinkedIn",
      id: env.LINKEDIN_OAUTH_CLIENT_ID,
      secret: env.LINKEDIN_OAUTH_CLIENT_SECRET,
    },
  ];

  return pairs
    .filter(
      (provider) =>
        (provider.id === "" && provider.secret !== "") ||
        (provider.id !== "" && provider.secret === "")
    )
    .map(
      (provider) =>
        `${provider.name} OAuth requires both client id and client secret`
    );
};

const checkValkeyPassword = (env: Env): string[] => {
  if (env.NODE_ENV !== "production" || env.VALKEY_PASSWORD !== "") {
    return [];
  }

  const errors: string[] = [];

  if (env.QUEUES_ENABLED) {
    errors.push(
      "VALKEY_PASSWORD required in production when QUEUES_ENABLED=true"
    );
  }

  if (env.CACHE_ENABLED && env.CACHE_PROVIDER === "valkey") {
    errors.push(
      "VALKEY_PASSWORD required in production when CACHE_PROVIDER=valkey"
    );
  }

  if (env.NOTIFICATIONS_SSE_ENABLED) {
    errors.push(
      "VALKEY_PASSWORD required in production when NOTIFICATIONS_SSE_ENABLED=true"
    );
  }

  if (hasOAuthProvider(env)) {
    errors.push(
      "VALKEY_PASSWORD required in production when OAuth providers are configured"
    );
  }

  return errors;
};

const checkWebPushVapid = (env: Env): string[] => {
  const values = [
    env.WEB_PUSH_VAPID_PUBLIC,
    env.WEB_PUSH_VAPID_PRIVATE,
    env.WEB_PUSH_VAPID_SUBJECT,
  ];
  const setCount = values.filter((value) => value !== "").length;

  if (setCount === 0 || setCount === values.length) {
    return [];
  }

  return [
    "WEB_PUSH_VAPID_PUBLIC, WEB_PUSH_VAPID_PRIVATE, and WEB_PUSH_VAPID_SUBJECT must all be set together (or all empty to disable the channel). Generate a fresh set with `bun run vapid:generate`.",
  ];
};

const checkInvariants = (env: Env): string[] => [
  ...checkUrls(env),
  ...checkOrigins(env),
  ...checkEmailProvider(env),
  ...checkAIProvider(env),
  ...checkBilling(env),
  ...checkOAuth(env),
  ...checkValkeyPassword(env),
  ...checkWebPushVapid(env),
];

const formatSchemaErrors = (raw: Record<string, unknown>): string[] => {
  const errors: string[] = [];

  for (const error of Value.Errors(envSchema, raw)) {
    const stripped = error.path.replace(/^\//, "");
    const key = stripped === "" ? "<root>" : stripped;

    errors.push(`${key}: ${error.message}`);
  }

  return errors;
};

export const validateEnv = (source: EnvSource = process.env): Env => {
  const raw = readRaw(source);
  const schemaErrors = formatSchemaErrors(raw);

  if (schemaErrors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${schemaErrors.join("\n  - ")}`
    );
  }

  const parsed = Value.Cast(envSchema, raw);
  const invariantErrors = checkInvariants(parsed);

  if (invariantErrors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${invariantErrors.join("\n  - ")}`
    );
  }

  return parsed;
};
