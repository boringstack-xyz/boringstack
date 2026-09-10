/**
 * F05: session revocation depends on optional, best-effort cache state.
 *
 * Production boot accepts `CACHE_ENABLED=false` together with
 * `JWT_REVOCATION_FAIL_CLOSED=true`. The operator has explicitly asked for
 * strict revocation semantics and gets none: the no-op cache provider returns
 * misses without throwing, and the fail-closed branches in
 * `src/lib/jwt/jwt-revocation.ts` only run inside `catch`, so they never
 * trigger. Revocation is silently off.
 *
 * The mechanism is that the rule which would catch this declines to run:
 *
 *   src/config/env/validate.ts:728
 *     if (env.NODE_ENV !== "production" || !env.CACHE_ENABLED) return [];
 *
 * Disabling the cache short-circuits the only check that inspects the cache.
 * `JWT_REVOCATION_FAIL_CLOSED` is not named by any rule in `checkInvariants`,
 * nor by `src/boot/invariants.ts`.
 *
 * POLICY (see ROADMAP, security review decision 4): this encodes fail-closed,
 * i.e. an unsupported combination is refused at boot rather than degrading to
 * "revocation quietly disabled". If the project instead decides that
 * availability wins and revocation may be best-effort, invert the expectation
 * here and make the degradation explicit and logged.
 */
import { describe, expect, test } from "bun:test";

import { validateEnv } from "../src/config/env/validate";

/*
 * A minimal env that passes every *other* production invariant, so a failure
 * here is attributable to the cache/revocation pairing and not to some
 * unrelated missing secret. Built from src/config/env/schema.ts defaults.
 */
const productionBase = (): Record<string, string> => ({
  NODE_ENV: "production",
  PORT: "7330",
  DATABASE_URL: "postgresql://app:app@db:5432/app",
  JWT_SECRET: "x".repeat(64),
  FRONTEND_URL: "https://app.example.com",
  PUBLIC_API_URL: "https://api.example.com",
  CORS_ORIGINS: "https://app.example.com",
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  EMAIL_PROVIDER: "cloudflare",
  EMAIL_FROM: "noreply@boringstack-spec.dev",
  CLOUDFLARE_ACCOUNT_ID: "cf-account-id",
  CLOUDFLARE_EMAIL_API_TOKEN: "cf-email-token",
  QUEUES_ENABLED: "true",
  VALKEY_HOST: "valkey",
  VALKEY_PORT: "6379",
  VALKEY_PASSWORD: "valkey-password",
  CACHE_PROVIDER: "valkey",
  CACHE_ENABLED: "true",
});

describe("F05 revocation requires a durable store", () => {
  test("production rejects fail-closed revocation with the cache disabled", () => {
    const env = {
      ...productionBase(),
      CACHE_ENABLED: "false",
      JWT_REVOCATION_FAIL_CLOSED: "true",
    };

    /*
     * Asserting on the message, not merely that it throws: this env is
     * otherwise valid, so a throw for an unrelated reason would be a false
     * pass. The message must name the actual conflict.
     */
    expect(() => validateEnv(env)).toThrow(/revocation/i);
  });

  /*
   * Control, not a finding. `checkCacheProviderInProd` already rejects this
   * one, and it must keep doing so: it is the rule whose early return on
   * `!CACHE_ENABLED` opens the hole above. If this ever starts passing, the
   * rule was weakened rather than extended.
   */
  test("control: production already rejects a non-valkey provider", () => {
    const env = {
      ...productionBase(),
      CACHE_PROVIDER: "memory",
      JWT_REVOCATION_FAIL_CLOSED: "true",
    };

    expect(() => validateEnv(env)).toThrow(/CACHE_PROVIDER must be valkey/i);
  });

  test("the supported production combination still boots", () => {
    const env = {
      ...productionBase(),
      JWT_REVOCATION_FAIL_CLOSED: "true",
    };

    // Negative control: the rule must not reject a correct configuration.
    expect(() => validateEnv(env)).not.toThrow();
  });
});
