import "dotenv/config";

import { Value } from "@sinclair/typebox/value";
import { envSchema, type Env } from "./schema";

type EnvSource = Record<string, string | undefined>;

export const toInt = (
  raw: string | undefined,
  fallback: number,
  name?: string
): number => {
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const parsed = parseInt(raw, 10);

  if (Number.isNaN(parsed)) {
    const label = name ?? "<int>";

    throw new Error(
      `${label}: invalid integer "${raw}". Set a numeric value or unset the variable to use the default (${String(fallback)}).`
    );
  }

  return parsed;
};

/*
 * Strict boolean parser. Accepts a small set of canonical truthy/falsy
 * tokens (case-insensitive) and throws on anything else, so a misspelled
 * value like `DATABASE_SSL_REJECT_UNAUTHORIZED=Tru` aborts boot with a
 * named error instead of silently downgrading TLS verification. Unset
 * (undefined) resolves to false because every boolean has an explicit
 * default at the schema level.
 */
const BOOL_TRUE_TOKENS = new Set(["true", "1", "yes", "on"]);
const BOOL_FALSE_TOKENS = new Set(["false", "0", "no", "off", ""]);

export const toBool = (raw: string | undefined, name?: string): boolean => {
  if (raw === undefined) {
    return false;
  }

  const normalized = raw.trim().toLowerCase();

  if (BOOL_TRUE_TOKENS.has(normalized)) {
    return true;
  }

  if (BOOL_FALSE_TOKENS.has(normalized)) {
    return false;
  }

  const label = name ?? "<bool>";
  const accepted = [...BOOL_TRUE_TOKENS, ...BOOL_FALSE_TOKENS]
    .filter((token) => token !== "")
    .join(", ");

  throw new Error(
    `${label}: invalid boolean "${raw}". Accepted (case-insensitive): ${accepted}.`
  );
};

/**
 * For booleans whose schema default is `true`. Calling `toBool` alone
 * silently flips an unset variable to `false`, drifting from the
 * documented schema. This helper threads the schema default through so
 * the resolved value matches what `schema.ts` declares — keeping the
 * env file, the schema, and validate.ts in lockstep.
 */
export const toBoolWithDefault = (
  raw: string | undefined,
  defaultValue: boolean,
  name?: string
): boolean => (raw === undefined ? defaultValue : toBool(raw, name));

export const toFloat = (
  raw: string | undefined,
  fallback: number,
  name?: string
): number => {
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(raw);

  if (Number.isNaN(parsed)) {
    const label = name ?? "<float>";

    throw new Error(
      `${label}: invalid number "${raw}". Set a numeric value or unset the variable to use the default (${String(fallback)}).`
    );
  }

  return parsed;
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
  PORT: toInt(source.PORT, 7330, "PORT"),
  LOG_LEVEL: source.LOG_LEVEL ?? "info",
  APP_NAME: source.APP_NAME ?? "API Template",
});

const readDatabase = (source: EnvSource) => ({
  DATABASE_URL: nonEmpty(
    source.DATABASE_URL,
    source.NODE_ENV === "test" ? "postgresql://test:test@127.0.0.1:1/test" : ""
  ),
  DATABASE_POOL_SIZE: toInt(
    source.DATABASE_POOL_SIZE,
    10,
    "DATABASE_POOL_SIZE"
  ),
  DATABASE_SSL_REJECT_UNAUTHORIZED:
    source.DATABASE_SSL_REJECT_UNAUTHORIZED === undefined
      ? true
      : toBool(
          source.DATABASE_SSL_REJECT_UNAUTHORIZED,
          "DATABASE_SSL_REJECT_UNAUTHORIZED"
        ),
  DATABASE_SSL_CA: source.DATABASE_SSL_CA ?? "",
});

const readAuth = (source: EnvSource) => ({
  JWT_SECRET: nonEmpty(
    source.JWT_SECRET,
    source.NODE_ENV === "test"
      ? "test-only-jwt-secret-padded-to-thirty-two-chars"
      : ""
  ),
  JWT_REVOCATION_FAIL_CLOSED: toBoolWithDefault(
    source.JWT_REVOCATION_FAIL_CLOSED,
    false,
    "JWT_REVOCATION_FAIL_CLOSED"
  ),
  /*
   * Deterministic test-only key so MFA round-trip tests don't need an
   * env file. 32 bytes base64 = 44 chars. Production deploys must set
   * this to a freshly generated value before any user enables MFA.
   */
  MFA_ENCRYPTION_KEY: nonEmpty(
    source.MFA_ENCRYPTION_KEY,
    source.NODE_ENV === "test"
      ? "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
      : ""
  ),
  SUPERUSER_EMAIL: source.SUPERUSER_EMAIL ?? "",
  SUPERUSER_PASSWORD: source.SUPERUSER_PASSWORD ?? "",
  E2E_TEST_ENDPOINTS_ENABLED: toBool(
    source.E2E_TEST_ENDPOINTS_ENABLED,
    "E2E_TEST_ENDPOINTS_ENABLED"
  ),
});

const readUrls = (source: EnvSource) => ({
  FRONTEND_URL: nonEmpty(
    source.FRONTEND_URL,
    source.NODE_ENV === "test" ? "http://localhost:5173" : ""
  ),
  ALLOWED_ORIGINS: toCsv(source.ALLOWED_ORIGINS),
  PUBLIC_API_URL:
    source.PUBLIC_API_URL ??
    `http://localhost:${String(toInt(source.PORT, 7330, "PORT"))}`,
  NOTIFICATION_SETTINGS_URL: source.NOTIFICATION_SETTINGS_URL ?? "",
});

const readRateLimit = (source: EnvSource) => ({
  RATE_LIMIT_MAX: toInt(source.RATE_LIMIT_MAX, 100, "RATE_LIMIT_MAX"),
  RATE_LIMIT_WINDOW_MS: toInt(
    source.RATE_LIMIT_WINDOW_MS,
    60_000,
    "RATE_LIMIT_WINDOW_MS"
  ),
  AUTH_RATE_LIMIT_MAX: toInt(
    source.AUTH_RATE_LIMIT_MAX,
    10,
    "AUTH_RATE_LIMIT_MAX"
  ),
  AUTH_RATE_LIMIT_WINDOW_MS: toInt(
    source.AUTH_RATE_LIMIT_WINDOW_MS,
    60_000,
    "AUTH_RATE_LIMIT_WINDOW_MS"
  ),
  TRUST_PROXY: toBool(source.TRUST_PROXY, "TRUST_PROXY"),
});

const readSentry = (source: EnvSource) => ({
  SENTRY_DSN: source.SENTRY_DSN ?? "",
  SENTRY_TRACES_SAMPLE_RATE: toFloat(
    source.SENTRY_TRACES_SAMPLE_RATE,
    0,
    "SENTRY_TRACES_SAMPLE_RATE"
  ),
});

const readOpenTelemetry = (source: EnvSource) => ({
  OTEL_EXPORTER_OTLP_ENDPOINT: source.OTEL_EXPORTER_OTLP_ENDPOINT ?? "",
  OTEL_SERVICE_NAME: source.OTEL_SERVICE_NAME ?? "boringstack-api",
});

const readEmail = (source: EnvSource) => ({
  EMAIL_PROVIDER: source.EMAIL_PROVIDER ?? "cloudflare",
  EMAIL_FROM: source.EMAIL_FROM ?? "noreply@example.com",
  EMAIL_TEMPLATES_DIR: source.EMAIL_TEMPLATES_DIR ?? "",
  CLOUDFLARE_ACCOUNT_ID: source.CLOUDFLARE_ACCOUNT_ID ?? "",
  CLOUDFLARE_EMAIL_API_TOKEN: source.CLOUDFLARE_EMAIL_API_TOKEN ?? "",
  RESEND_API_KEY: source.RESEND_API_KEY ?? "",
  RESEND_WEBHOOK_SECRET: source.RESEND_WEBHOOK_SECRET ?? "",
  SENDGRID_API_KEY: source.SENDGRID_API_KEY ?? "",
  SENDGRID_WEBHOOK_PUBLIC_KEY: source.SENDGRID_WEBHOOK_PUBLIC_KEY ?? "",
  SMTP_HOST: source.SMTP_HOST ?? "",
  SMTP_PORT: toInt(source.SMTP_PORT, 25, "SMTP_PORT"),
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
  AI_ENABLED: toBool(source.AI_ENABLED, "AI_ENABLED"),
  AI_PROVIDER: source.AI_PROVIDER ?? "openai",
  OPENAI_API_KEY: source.OPENAI_API_KEY ?? "",
  OPENAI_BASE_URL: source.OPENAI_BASE_URL ?? "",
  OPENAI_DEFAULT_HEADERS: source.OPENAI_DEFAULT_HEADERS ?? "",
  ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY ?? "",
});

const readMultiTenant = (source: EnvSource) => ({
  ACCOUNT_DOMAIN_CLAIMING: toBool(
    source.ACCOUNT_DOMAIN_CLAIMING,
    "ACCOUNT_DOMAIN_CLAIMING"
  ),
});

const readBilling = (source: EnvSource) => ({
  BILLING_ENABLED: toBool(source.BILLING_ENABLED, "BILLING_ENABLED"),
  STRIPE_SECRET_KEY: source.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: source.STRIPE_WEBHOOK_SECRET ?? "",
  STRIPE_PRICE_ID_FREE: source.STRIPE_PRICE_ID_FREE ?? "",
  STRIPE_PRICE_ID_PRO: source.STRIPE_PRICE_ID_PRO ?? "",
});

const readBackground = (source: EnvSource) => ({
  /*
   * Schema defaults for QUEUES_ENABLED, CACHE_ENABLED, and
   * NOTIFICATIONS_SSE_ENABLED are all `true` — see schema.ts. Calling
   * `toBool` alone would collapse an unset variable to `false`, silently
   * weakening JWT revocation (cache-backed) and SSE delivery for any
   * deploy that didn't explicitly set them. `toBoolWithDefault` keeps
   * the resolved config aligned with the documented schema.
   */
  QUEUES_ENABLED: toBoolWithDefault(
    source.QUEUES_ENABLED,
    true,
    "QUEUES_ENABLED"
  ),
  CACHE_ENABLED: toBoolWithDefault(source.CACHE_ENABLED, true, "CACHE_ENABLED"),
  CACHE_PROVIDER: source.CACHE_PROVIDER ?? "memory",
  NOTIFICATIONS_SSE_ENABLED: toBoolWithDefault(
    source.NOTIFICATIONS_SSE_ENABLED,
    true,
    "NOTIFICATIONS_SSE_ENABLED"
  ),
});

const readWebPush = (source: EnvSource) => ({
  WEB_PUSH_VAPID_PUBLIC: source.WEB_PUSH_VAPID_PUBLIC ?? "",
  WEB_PUSH_VAPID_PRIVATE: source.WEB_PUSH_VAPID_PRIVATE ?? "",
  WEB_PUSH_VAPID_SUBJECT: source.WEB_PUSH_VAPID_SUBJECT ?? "",
});

const readValkey = (source: EnvSource) => ({
  VALKEY_HOST: source.VALKEY_HOST ?? "localhost",
  VALKEY_PORT: toInt(source.VALKEY_PORT, 6379, "VALKEY_PORT"),
  VALKEY_PASSWORD: source.VALKEY_PASSWORD ?? "",
  VALKEY_DB: toInt(source.VALKEY_DB, 0, "VALKEY_DB"),
});

const readRaw = (source: EnvSource): Record<string, unknown> => ({
  ...readCore(source),
  ...readDatabase(source),
  ...readAuth(source),
  ...readUrls(source),
  ...readRateLimit(source),
  ...readSentry(source),
  ...readOpenTelemetry(source),
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

const checkHttpUrl = (
  value: string,
  name: string,
  requireHttps: boolean
): string[] => {
  try {
    const parsed = new URL(value);

    if (requireHttps) {
      return parsed.protocol === "https:"
        ? []
        : [
            `${name} must use https:// in production (got "${parsed.protocol}//"). Secure cookies, OAuth callbacks, billing return URLs, and signed email links all require TLS.`,
          ];
    }

    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";

    return isHttp ? [] : [`${name} must be an http(s) URL`];
  } catch {
    return [`${name} must be a valid URL`];
  }
};

const checkUrls = (env: Env): string[] => {
  const requireHttps = env.NODE_ENV === "production";

  return [
    ...checkHttpUrl(env.FRONTEND_URL, "FRONTEND_URL", requireHttps),
    ...checkHttpUrl(env.PUBLIC_API_URL, "PUBLIC_API_URL", requireHttps),
    ...(env.NOTIFICATION_SETTINGS_URL === ""
      ? []
      : checkHttpUrl(
          env.NOTIFICATION_SETTINGS_URL,
          "NOTIFICATION_SETTINGS_URL",
          requireHttps
        )),
  ];
};

/**
 * MFA_ENCRYPTION_KEY must be present in production so a misconfigured
 * deploy aborts at boot rather than surfacing as a 500 on the first
 * MFA enroll/verify request.
 */
const checkMfaKeyInProd = (env: Env): string[] => {
  if (env.NODE_ENV !== "production" || env.MFA_ENCRYPTION_KEY !== "") {
    return [];
  }

  return [
    "MFA_ENCRYPTION_KEY is required in production. Generate one with `openssl rand -base64 32`.",
  ];
};

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

/**
 * Catches the most common deploy-day footgun: shipping the template's
 * placeholder sender domain to a real email provider. Every provider
 * rejects sends from unverified domains, but the rejection surfaces
 * deep in a queue worker — the validator stops the process before
 * the first send instead.
 */
const PLACEHOLDER_FROM_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "localhost",
] as const;

const isPlaceholderFromAddress = (from: string): boolean => {
  const atIndex = from.indexOf("@");

  if (atIndex === -1) {
    return false;
  }

  const domain = from.slice(atIndex + 1).toLowerCase();

  return PLACEHOLDER_FROM_DOMAINS.some(
    (placeholder) =>
      domain === placeholder || domain.endsWith(`.${placeholder}`)
  );
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

    return checkEmailFromDomain(env);
  }

  // SMTP just needs a host; auth is optional (Mailpit accepts any).
  if (env.EMAIL_PROVIDER === "smtp") {
    return env.SMTP_HOST === ""
      ? ["Email provider 'smtp' requires SMTP_HOST"]
      : checkEmailFromDomain(env);
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

  return checkEmailFromDomain(env);
};

const checkEmailFromDomain = (env: Env): string[] => {
  if (!isPlaceholderFromAddress(env.EMAIL_FROM)) {
    return [];
  }

  return [
    `EMAIL_FROM "${env.EMAIL_FROM}" uses a placeholder domain. ` +
      "Set it to an address on a domain you control and verified with the provider.",
  ];
};

/**
 * Rejects placeholder secrets in production. The env-example files ship
 * obviously-fake values long enough to pass the schema's minLength check
 * (e.g. JWT_SECRET=replace-with-openssl-rand-base64-48), and Docker
 * Compose has hardcoded migration-task placeholders that exist only to
 * satisfy schema validation in containers that never sign tokens.
 * Without this check, an operator who copies the example file verbatim
 * boots production with a known string. The patterns below cover every
 * placeholder string that ships in the template today.
 */
const PLACEHOLDER_SECRET_EXACT_MATCHES = [
  "test-only-jwt-secret-padded-to-thirty-two-chars",
  "migrate-placeholder-secret-padded-to-thirty-two-chars",
  "api-migrate-placeholder-secret-padded-to-thirty-two",
  "docker-compose-api-dev-jwt-secret-keys",
  "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
] as const;

/*
 * Precomputed lowercase denylist so the exact-match check uses the
 * same case-folding as the prefix and substring checks below. Without
 * this, an attacker (or a careless deploy) could bypass the guard by
 * uppercasing the placeholder.
 */
const PLACEHOLDER_SECRET_EXACT_MATCHES_LOWER =
  PLACEHOLDER_SECRET_EXACT_MATCHES.map((value) => value.toLowerCase());

const PLACEHOLDER_SECRET_PREFIXES = [
  "replace-with-",
  "change-me-",
  "your-",
  "example-",
] as const;

const isPlaceholderSecret = (value: string): boolean => {
  const lower = value.toLowerCase();

  if (PLACEHOLDER_SECRET_EXACT_MATCHES_LOWER.includes(lower)) {
    return true;
  }

  if (PLACEHOLDER_SECRET_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }

  return lower.includes("placeholder");
};

const PLACEHOLDER_SECRET_FIELDS: readonly {
  readonly name: keyof Env;
  readonly generator: string;
}[] = [
  { name: "JWT_SECRET", generator: "openssl rand -base64 48" },
  { name: "MFA_ENCRYPTION_KEY", generator: "openssl rand -base64 32" },
];

const checkPlaceholderSecrets = (env: Env): string[] => {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  return PLACEHOLDER_SECRET_FIELDS.flatMap(({ name, generator }) => {
    const value = env[name];

    if (typeof value !== "string" || !isPlaceholderSecret(value)) {
      return [];
    }

    return [
      `${name} looks like a placeholder ("${value}"). ` +
        `Generate a real value with \`${generator}\` and set it before boot.`,
    ];
  });
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

/**
 * Production must run with QUEUES_ENABLED=true so transactional email
 * (password reset, verification, account events) goes through BullMQ
 * with retries instead of a single inline attempt. Without it, a
 * provider blip silently drops the message and the user sees a
 * "we sent it" toast for an email that never arrived.
 */
const checkQueuesEnabledInProd = (env: Env): string[] => {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  return env.QUEUES_ENABLED
    ? []
    : [
        "QUEUES_ENABLED must be true in production so transactional email retries on transient failure",
      ];
};

/**
 * Production must back the cache with Valkey when caching is enabled.
 * JWT revocation (logout, password-reset session kill, per-jti blocklist)
 * keeps its state in cacheService; the in-memory provider is per-process,
 * so revocations vanish on restart and never propagate across replicas —
 * a logout on one instance would leave the token valid on every other.
 */
const checkCacheProviderInProd = (env: Env): string[] => {
  if (env.NODE_ENV !== "production" || !env.CACHE_ENABLED) {
    return [];
  }

  return env.CACHE_PROVIDER === "valkey"
    ? []
    : [
        "CACHE_PROVIDER must be valkey in production when CACHE_ENABLED=true so JWT revocation state survives restarts and is shared across replicas",
      ];
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
  ...checkMfaKeyInProd(env),
  ...checkEmailProvider(env),
  ...checkAIProvider(env),
  ...checkBilling(env),
  ...checkOAuth(env),
  ...checkQueuesEnabledInProd(env),
  ...checkCacheProviderInProd(env),
  ...checkValkeyPassword(env),
  ...checkWebPushVapid(env),
  ...checkPlaceholderSecrets(env),
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
