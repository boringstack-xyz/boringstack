import { beforeEach, describe, expect, it } from "bun:test";
import {
  nonEmpty,
  toBool,
  toBoolWithDefault,
  toCsv,
  toFloat,
  toInt,
  validateEnv,
} from "../../../src/config/env/validate";

describe("toInt", () => {
  it("returns the parsed integer when present", () => {
    expect(toInt("42", 0)).toBe(42);
  });

  it("falls back when undefined", () => {
    expect(toInt(undefined, 7)).toBe(7);
  });

  it("falls back when empty string", () => {
    expect(toInt("", 7)).toBe(7);
  });

  it("throws on non-numeric input (no silent fallback)", () => {
    expect(() => toInt("not-a-number", 7, "PORT")).toThrow(
      /PORT.*not-a-number/
    );
  });

  it("throws without a name label using a generic placeholder", () => {
    expect(() => toInt("garbage", 0)).toThrow(/<int>/);
  });
});

describe("toFloat", () => {
  it("returns the parsed float when present", () => {
    expect(toFloat("0.25", 1)).toBe(0.25);
  });

  it("returns integers as floats", () => {
    expect(toFloat("3", 0)).toBe(3);
  });

  it("falls back when undefined", () => {
    expect(toFloat(undefined, 0.1)).toBe(0.1);
  });

  it("falls back when empty string", () => {
    expect(toFloat("", 0.1)).toBe(0.1);
  });

  it("throws on non-numeric input (no silent fallback)", () => {
    expect(() =>
      toFloat("not-a-float", 0.1, "SENTRY_TRACES_SAMPLE_RATE")
    ).toThrow(/SENTRY_TRACES_SAMPLE_RATE.*not-a-float/);
  });
});

describe("nonEmpty", () => {
  it("returns the value when set", () => {
    expect(nonEmpty("present", "fallback")).toBe("present");
  });

  it("returns the fallback when undefined", () => {
    expect(nonEmpty(undefined, "fallback")).toBe("fallback");
  });

  it("returns the fallback when empty string", () => {
    expect(nonEmpty("", "fallback")).toBe("fallback");
  });

  it("does not treat whitespace as empty", () => {
    expect(nonEmpty("   ", "fallback")).toBe("   ");
  });
});

describe("toBool", () => {
  it("returns true for canonical truthy tokens (case-insensitive)", () => {
    expect(toBool("true")).toBe(true);
    expect(toBool("TRUE")).toBe(true);
    expect(toBool("True")).toBe(true);
    expect(toBool("1")).toBe(true);
    expect(toBool("yes")).toBe(true);
    expect(toBool("YES")).toBe(true);
    expect(toBool("on")).toBe(true);
    expect(toBool("ON")).toBe(true);
    expect(toBool(" true ")).toBe(true);
  });

  it("returns false for canonical falsy tokens", () => {
    expect(toBool("false")).toBe(false);
    expect(toBool("FALSE")).toBe(false);
    expect(toBool("0")).toBe(false);
    expect(toBool("no")).toBe(false);
    expect(toBool("off")).toBe(false);
    expect(toBool("")).toBe(false);
    expect(toBool(undefined)).toBe(false);
  });

  it("throws on garbage input — names the variable in the error", () => {
    expect(() => toBool("truee", "BILLING_ENABLED")).toThrow(
      /BILLING_ENABLED.*invalid boolean.*truee/
    );
    expect(() => toBool("maybe", "TRUST_PROXY")).toThrow(
      /TRUST_PROXY.*invalid boolean/
    );
  });

  it("throws without a name label using a generic placeholder", () => {
    expect(() => toBool("garbage")).toThrow(/<bool>/);
  });
});

describe("toBoolWithDefault", () => {
  it("returns the schema default when the variable is unset", () => {
    expect(toBoolWithDefault(undefined, true, "CACHE_ENABLED")).toBe(true);
    expect(toBoolWithDefault(undefined, false, "DEBUG_FLAG")).toBe(false);
  });

  it("parses the provided value when set", () => {
    expect(toBoolWithDefault("false", true, "CACHE_ENABLED")).toBe(false);
    expect(toBoolWithDefault("true", false, "DEBUG_FLAG")).toBe(true);
  });

  it("still throws on garbage input (no silent fallback)", () => {
    expect(() =>
      toBoolWithDefault("totally-not-a-bool", true, "CACHE_ENABLED")
    ).toThrow(/CACHE_ENABLED/);
  });
});

describe("toCsv", () => {
  it("splits on commas and trims whitespace", () => {
    expect(toCsv("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("drops empty entries", () => {
    expect(toCsv("a,,b, ,c")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for undefined / empty input", () => {
    expect(toCsv(undefined)).toEqual([]);
    expect(toCsv("")).toEqual([]);
  });
});

type TestEnv = Record<string, string | undefined>;

let testEnv: TestEnv;

const seedValid = (): TestEnv => ({
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://x:y@localhost:5432/db",
  JWT_SECRET: "x".repeat(40),
  FRONTEND_URL: "http://localhost:5173",
  PUBLIC_API_URL: "http://localhost:7330",
  ALLOWED_ORIGINS: "",
  EMAIL_PROVIDER: "resend",
  EMAIL_FROM: "noreply@acme.test",
  RESEND_API_KEY: "rk_test",
});

const REAL_JWT_SECRET = "x".repeat(40);
const REAL_MFA_KEY = "RGdmRXJVbmlrV3VqWUFwR2VVZkdLUlBmYWxsa2VBQ08=";

/*
 * Tests that flip NODE_ENV to production need to satisfy the additional
 * prod-only invariants the validator enforces: https public URLs and a
 * non-empty MFA encryption key. This helper layers those on top of a
 * test's existing assignments so each test keeps its specific intent
 * focused (e.g. "VALKEY_PASSWORD required") without restating the full
 * production seed.
 */
const applyProdDefaults = (env: TestEnv): void => {
  env.FRONTEND_URL = "https://app.example.test";
  env.PUBLIC_API_URL = "https://api.example.test";
  env.MFA_ENCRYPTION_KEY = REAL_MFA_KEY;
  env.CACHE_PROVIDER = "valkey";
};

/*
 * Self-contained production-ready seed used by the placeholder-secrets
 * and HTTPS-only blocks. Other blocks compose smaller mutations onto
 * `testEnv` via `applyProdDefaults`.
 */
const seedProd = (): TestEnv => ({
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://x:y@localhost:5432/db",
  JWT_SECRET: REAL_JWT_SECRET,
  MFA_ENCRYPTION_KEY: REAL_MFA_KEY,
  FRONTEND_URL: "https://app.example.test",
  PUBLIC_API_URL: "https://app.example.test/api",
  ALLOWED_ORIGINS: "",
  EMAIL_PROVIDER: "resend",
  EMAIL_FROM: "noreply@app.example.test",
  RESEND_API_KEY: "rk_test",
  VALKEY_PASSWORD: "secret",
  CACHE_PROVIDER: "valkey",
});

beforeEach(() => {
  testEnv = seedValid();
});

describe("validateEnv", () => {
  it("accepts a minimally-valid development config", () => {
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("background defaults match the schema when env vars are unset", () => {
    /*
     * Schema says QUEUES_ENABLED / CACHE_ENABLED / NOTIFICATIONS_SSE_ENABLED
     * default to `true`. Operators copying a minimal prod env (compose
     * without explicit overrides) shouldn't silently end up with cache
     * off — that weakens JWT revocation and shared rate limits. Lock
     * the schema↔resolved-config alignment here.
     */
    delete testEnv.QUEUES_ENABLED;
    delete testEnv.CACHE_ENABLED;
    delete testEnv.NOTIFICATIONS_SSE_ENABLED;

    const resolved = validateEnv(testEnv);

    expect(resolved.QUEUES_ENABLED).toBe(true);
    expect(resolved.CACHE_ENABLED).toBe(true);
    expect(resolved.NOTIFICATIONS_SSE_ENABLED).toBe(true);
  });

  it("rejects a JWT_SECRET shorter than 32 chars", () => {
    testEnv.JWT_SECRET = "too-short";
    expect(() => validateEnv(testEnv)).toThrow(/JWT_SECRET/);
  });

  it("JWT_REVOCATION_FAIL_CLOSED defaults to false and parses true", () => {
    expect(validateEnv(testEnv).JWT_REVOCATION_FAIL_CLOSED).toBe(false);

    testEnv.JWT_REVOCATION_FAIL_CLOSED = "true";
    expect(validateEnv(testEnv).JWT_REVOCATION_FAIL_CLOSED).toBe(true);
  });

  it("accepts production with empty ALLOWED_ORIGINS (same-origin deployment)", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "";
    testEnv.EMAIL_PROVIDER = "resend";
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("rejects production CACHE_ENABLED with the in-memory cache provider", () => {
    testEnv.NODE_ENV = "production";
    testEnv.EMAIL_PROVIDER = "resend";
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    testEnv.CACHE_PROVIDER = "memory";
    expect(() => validateEnv(testEnv)).toThrow(/CACHE_PROVIDER must be valkey/);
  });

  it("accepts production with CACHE_ENABLED=false and the memory provider", () => {
    testEnv.NODE_ENV = "production";
    testEnv.EMAIL_PROVIDER = "resend";
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    testEnv.CACHE_PROVIDER = "memory";
    testEnv.CACHE_ENABLED = "false";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("rejects production ALLOWED_ORIGINS that aren't HTTPS", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "http://example.com";
    testEnv.RESEND_API_KEY = "rk_test";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/HTTPS/);
  });

  it("rejects wildcard origins in production", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "https://*.example.com";
    testEnv.RESEND_API_KEY = "rk_test";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/HTTPS|wildcard/);
  });

  it("does not require the active provider's API key in development (email uses noop when empty)", () => {
    testEnv.EMAIL_PROVIDER = "sendgrid";
    testEnv.SENDGRID_API_KEY = "";
    testEnv.RESEND_API_KEY = "";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("requires the active provider's API key in production", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "https://example.com";
    testEnv.EMAIL_PROVIDER = "sendgrid";
    testEnv.SENDGRID_API_KEY = "";
    testEnv.RESEND_API_KEY = "";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/Email provider/);
  });

  it("does not require email keys in test mode", () => {
    testEnv.NODE_ENV = "test";
    testEnv.EMAIL_PROVIDER = "resend";
    testEnv.RESEND_API_KEY = "";
    testEnv.DATABASE_URL = "";
    testEnv.JWT_SECRET = "";
    testEnv.FRONTEND_URL = "";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("requires OPENAI_API_KEY when AI_PROVIDER=openai", () => {
    testEnv.AI_ENABLED = "true";
    testEnv.AI_PROVIDER = "openai";
    testEnv.OPENAI_API_KEY = "";
    expect(() => validateEnv(testEnv)).toThrow(/OPENAI_API_KEY/);
  });

  it("requires ANTHROPIC_API_KEY when AI_PROVIDER=anthropic", () => {
    testEnv.AI_ENABLED = "true";
    testEnv.AI_PROVIDER = "anthropic";
    testEnv.ANTHROPIC_API_KEY = "";
    expect(() => validateEnv(testEnv)).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("accepts AI_PROVIDER=openai with OpenAI key", () => {
    testEnv.AI_ENABLED = "true";
    testEnv.AI_PROVIDER = "openai";
    testEnv.OPENAI_API_KEY = "sk-test";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("accepts AI_PROVIDER=openai pointed at OpenRouter", () => {
    testEnv.AI_ENABLED = "true";
    testEnv.AI_PROVIDER = "openai";
    testEnv.OPENAI_API_KEY = "sk-or-test";
    testEnv.OPENAI_BASE_URL = "https://openrouter.ai/api/v1";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("accepts AI_PROVIDER=openai pointed at local Ollama", () => {
    testEnv.AI_ENABLED = "true";
    testEnv.AI_PROVIDER = "openai";
    testEnv.OPENAI_API_KEY = "ollama";
    testEnv.OPENAI_BASE_URL = "http://localhost:11434/v1";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("accepts AI_PROVIDER=anthropic with key", () => {
    testEnv.AI_ENABLED = "true";
    testEnv.AI_PROVIDER = "anthropic";
    testEnv.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("accepts AI_PROVIDER=noop without any keys", () => {
    testEnv.AI_ENABLED = "true";
    testEnv.AI_PROVIDER = "noop";
    testEnv.OPENAI_API_KEY = "";
    testEnv.ANTHROPIC_API_KEY = "";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("requires Stripe keys when BILLING_ENABLED=true (non-test)", () => {
    testEnv.BILLING_ENABLED = "true";
    testEnv.STRIPE_SECRET_KEY = "";
    testEnv.RESEND_API_KEY = "rk_test";
    expect(() => validateEnv(testEnv)).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("rejects a placeholder Stripe secret when BILLING_ENABLED=true", () => {
    testEnv.BILLING_ENABLED = "true";
    testEnv.STRIPE_SECRET_KEY = "your-stripe-secret-key";
    testEnv.STRIPE_WEBHOOK_SECRET = "test-stripe-webhook-secret";
    testEnv.STRIPE_PRICE_ID_FREE = "price_free";
    testEnv.STRIPE_PRICE_ID_PRO = "price_pro";
    testEnv.RESEND_API_KEY = "rk_test";
    expect(() => validateEnv(testEnv)).toThrow(
      /STRIPE_SECRET_KEY looks like a placeholder/
    );
  });

  it("accepts real-looking Stripe secrets when BILLING_ENABLED=true", () => {
    testEnv.BILLING_ENABLED = "true";
    testEnv.STRIPE_SECRET_KEY = "sk_test_51RealKeyValue";
    testEnv.STRIPE_WEBHOOK_SECRET = "test-stripe-webhook-secret";
    testEnv.STRIPE_PRICE_ID_FREE = "price_free";
    testEnv.STRIPE_PRICE_ID_PRO = "price_pro";
    testEnv.RESEND_API_KEY = "rk_test";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("requires VALKEY_PASSWORD in production with QUEUES_ENABLED=true", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "https://example.com";
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.QUEUES_ENABLED = "true";
    testEnv.VALKEY_PASSWORD = "";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/VALKEY_PASSWORD/);
  });

  it("rejects production with QUEUES_ENABLED=false (transactional email must retry)", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "";
    testEnv.EMAIL_PROVIDER = "resend";
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.EMAIL_FROM = "noreply@boringstack.test";
    testEnv.QUEUES_ENABLED = "false";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/QUEUES_ENABLED/);
  });

  it("coerces booleans from string env values", () => {
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.BILLING_ENABLED = "false";
    testEnv.QUEUES_ENABLED = "true";
    testEnv.VALKEY_PASSWORD = "secret";
    const env = validateEnv(testEnv);

    expect(env.BILLING_ENABLED).toBe(false);
    expect(env.QUEUES_ENABLED).toBe(true);
  });

  it("rejects production EMAIL_FROM on a placeholder domain", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "";
    testEnv.EMAIL_PROVIDER = "resend";
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.EMAIL_FROM = "noreply@example.com";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/placeholder domain/);
  });

  it("rejects production EMAIL_FROM on a placeholder subdomain", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "";
    testEnv.EMAIL_PROVIDER = "resend";
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.EMAIL_FROM = "noreply@mail.example.com";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/placeholder domain/);
  });

  it("allows the same placeholder address in development", () => {
    testEnv.EMAIL_FROM = "noreply@example.com";
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("requires SMTP_HOST when EMAIL_PROVIDER=smtp in production", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "";
    testEnv.EMAIL_PROVIDER = "smtp";
    testEnv.SMTP_HOST = "";
    testEnv.RESEND_API_KEY = "";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).toThrow(/SMTP_HOST/);
  });

  it("accepts EMAIL_PROVIDER=smtp with SMTP_HOST set (no auth — Mailpit)", () => {
    testEnv.NODE_ENV = "production";
    testEnv.ALLOWED_ORIGINS = "";
    testEnv.EMAIL_PROVIDER = "smtp";
    testEnv.SMTP_HOST = "mailpit";
    testEnv.SMTP_PORT = "1025";
    testEnv.VALKEY_PASSWORD = "secret";
    applyProdDefaults(testEnv);
    expect(() => validateEnv(testEnv)).not.toThrow();
  });

  it("parses ALLOWED_ORIGINS as a CSV", () => {
    testEnv.RESEND_API_KEY = "rk_test";
    testEnv.ALLOWED_ORIGINS = "http://a.com, http://b.com";
    const env = validateEnv(testEnv);

    expect(env.ALLOWED_ORIGINS).toEqual(["http://a.com", "http://b.com"]);
  });

  it("SUPERUSER_EMAIL and SUPERUSER_PASSWORD default to empty strings", () => {
    delete testEnv.SUPERUSER_EMAIL;
    delete testEnv.SUPERUSER_PASSWORD;
    const env = validateEnv(testEnv);

    expect(env.SUPERUSER_EMAIL).toBe("");
    expect(env.SUPERUSER_PASSWORD).toBe("");
  });

  it("parses E2E_TEST_ENDPOINTS_ENABLED as an opt-in boolean", () => {
    testEnv.E2E_TEST_ENDPOINTS_ENABLED = "true";
    const env = validateEnv(testEnv);

    expect(env.E2E_TEST_ENDPOINTS_ENABLED).toBe(true);
  });

  describe("placeholder secrets in production", () => {
    it("baseline: production accepts real JWT_SECRET + MFA_ENCRYPTION_KEY", () => {
      expect(() => validateEnv(seedProd())).not.toThrow();
    });

    it("rejects the api.prod.env.example JWT placeholder", () => {
      const env = seedProd();

      env.JWT_SECRET = "replace-with-openssl-rand-base64-48";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects the apps/api/.env.example JWT placeholder", () => {
      const env = seedProd();

      env.JWT_SECRET = "change-me-to-a-long-random-secret-at-least-32-chars";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects the compose api-migrate-prod JWT placeholder leaking into prod", () => {
      const env = seedProd();

      env.JWT_SECRET = "migrate-placeholder-secret-padded-to-thirty-two-chars";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects the compose api-migrate-dev JWT placeholder leaking into prod", () => {
      const env = seedProd();

      env.JWT_SECRET = "api-migrate-placeholder-secret-padded-to-thirty-two";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects the well-known test JWT secret in prod", () => {
      const env = seedProd();

      env.JWT_SECRET = "test-only-jwt-secret-padded-to-thirty-two-chars";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects uppercased exact-match placeholders (case-insensitive)", () => {
      const env = seedProd();

      env.JWT_SECRET = "TEST-ONLY-JWT-SECRET-PADDED-TO-THIRTY-TWO-CHARS";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects mixed-case exact-match placeholders", () => {
      const env = seedProd();

      env.JWT_SECRET = "Migrate-Placeholder-Secret-Padded-To-Thirty-Two-Chars";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects the well-known test MFA encryption key in prod", () => {
      const env = seedProd();

      env.MFA_ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
      expect(() => validateEnv(env)).toThrow(/MFA_ENCRYPTION_KEY.*placeholder/);
    });

    it("rejects any value containing 'placeholder' substring", () => {
      const env = seedProd();

      env.JWT_SECRET = "totally-legit-but-has-placeholder-in-it-padded";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("rejects 'your-' prefixed placeholder", () => {
      const env = seedProd();

      env.JWT_SECRET = "your-jwt-secret-here-keep-padded-thirty-two-cha";
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET.*placeholder/);
    });

    it("error message names the generator command", () => {
      const env = seedProd();

      env.JWT_SECRET = "replace-with-openssl-rand-base64-48";
      expect(() => validateEnv(env)).toThrow(/openssl rand -base64 48/);
    });

    it("error message for MFA names the 32-byte generator", () => {
      const env = seedProd();

      env.MFA_ENCRYPTION_KEY = "replace-with-openssl-rand-base64-32";
      expect(() => validateEnv(env)).toThrow(/openssl rand -base64 32/);
    });

    it("allows placeholder strings in development (dev compose uses them on purpose)", () => {
      testEnv.JWT_SECRET =
        "migrate-placeholder-secret-padded-to-thirty-two-chars";
      expect(() => validateEnv(testEnv)).not.toThrow();
    });

    it("allows the test MFA key in test mode (validator's own default)", () => {
      testEnv.NODE_ENV = "test";
      testEnv.MFA_ENCRYPTION_KEY =
        "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
      testEnv.DATABASE_URL = "";
      testEnv.JWT_SECRET = "";
      testEnv.FRONTEND_URL = "";
      testEnv.RESEND_API_KEY = "";
      expect(() => validateEnv(testEnv)).not.toThrow();
    });
  });

  describe("HTTPS-only public URLs in production", () => {
    it("rejects http:// FRONTEND_URL in production", () => {
      const env = seedProd();

      env.FRONTEND_URL = "http://app.example.test";
      expect(() => validateEnv(env)).toThrow(/FRONTEND_URL.*https/);
    });

    it("rejects http:// PUBLIC_API_URL in production", () => {
      const env = seedProd();

      env.PUBLIC_API_URL = "http://api.example.test";
      expect(() => validateEnv(env)).toThrow(/PUBLIC_API_URL.*https/);
    });

    it("rejects http:// NOTIFICATION_SETTINGS_URL in production", () => {
      const env = seedProd();

      env.NOTIFICATION_SETTINGS_URL = "http://app.example.test/settings";
      expect(() => validateEnv(env)).toThrow(
        /NOTIFICATION_SETTINGS_URL.*https/
      );
    });

    it("allows empty NOTIFICATION_SETTINGS_URL in production (optional field)", () => {
      const env = seedProd();

      env.NOTIFICATION_SETTINGS_URL = "";
      expect(() => validateEnv(env)).not.toThrow();
    });

    it("allows http://localhost in development", () => {
      // testEnv seed is already development with http://localhost values.
      expect(() => validateEnv(testEnv)).not.toThrow();
    });
  });

  describe("MFA_ENCRYPTION_KEY required in production", () => {
    const seedProdNoMfa = (): TestEnv => ({
      ...seedProd(),
      MFA_ENCRYPTION_KEY: "",
    });

    it("rejects empty MFA_ENCRYPTION_KEY in production", () => {
      expect(() => validateEnv(seedProdNoMfa())).toThrow(
        /MFA_ENCRYPTION_KEY is required in production/
      );
    });

    it("error message names the generator command", () => {
      expect(() => validateEnv(seedProdNoMfa())).toThrow(
        /openssl rand -base64 32/
      );
    });

    it("allows empty MFA_ENCRYPTION_KEY in development (MFA can be opted-out)", () => {
      testEnv.MFA_ENCRYPTION_KEY = "";
      expect(() => validateEnv(testEnv)).not.toThrow();
    });
  });
});
