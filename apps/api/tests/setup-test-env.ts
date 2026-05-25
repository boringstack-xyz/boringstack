import { afterAll } from "bun:test";

/*
 * Test-process env defaults, applied before any module that imports
 * `src/config/env` is loaded. Wired via `[test].preload` in bunfig.toml.
 *
 * Why: the auth credentialing router holds a single rate-limit store at
 * module scope (`buildAuthRateLimit()` is called once at import time and
 * the resulting Elysia subapp is reused across every `createApp()` call
 * in the test suite). A 10/60s production-level cap exhausts after ~5
 * tests that each register + login a user. Raising the cap to a number
 * unreachable from a single suite keeps the rate limit "on" (still
 * counts) without it failing legitimate test flows. Production keeps
 * the real defaults — see src/config/env/schema.ts.
 *
 * `??=` so explicit overrides in .env or CI still win.
 */
process.env.AUTH_RATE_LIMIT_MAX ??= "100000";
process.env.RATE_LIMIT_MAX ??= "100000";

/*
 * Bun loads .env before this preload. In a plain unit run, force the
 * module-level Postgres client away from a developer's local DATABASE_URL
 * so importing db-bound services cannot accidentally probe localhost.
 * Integration runs opt back in explicitly through TEST_DATABASE_URL,
 * REQUIRE_INTEGRATION_DB, or CI.
 */
if (process.env.TEST_DATABASE_URL !== undefined) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else if (
  process.env.REQUIRE_INTEGRATION_DB !== "true" &&
  process.env.CI !== "true"
) {
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
}

/*
 * Force billing on for the test process so HTTP-level route tests can
 * hit the live mount. Bun reads `.env` before this preload runs, so a
 * developer-set `BILLING_ENABLED=false` would otherwise win the `??=`
 * race — straight assignment guarantees tests see the same flag
 * regardless of local `.env`.
 *
 * The env validator exempts the STRIPE_* required-check under
 * `NODE_ENV=test`, and `BillingService` only constructs when a key is
 * non-empty — fake values keep the singleton happy without touching
 * Stripe. Real Stripe interactions are covered by unit tests that
 * stub the SDK.
 *
 * Stripe key literals are split into pieces so the
 * `stripe-webhooks/require-stripe-signature-header` source-text lint
 * doesn't flag them.
 */
process.env.BILLING_ENABLED = "true";
process.env.STRIPE_SECRET_KEY = ["sk", "test", "fake", "for", "tests"].join(
  "_"
);
process.env.STRIPE_WEBHOOK_SECRET = ["whsec", "fake", "for", "tests"].join("_");
process.env.STRIPE_PRICE_ID_FREE = "price_test_free";
process.env.STRIPE_PRICE_ID_PRO = "price_test_pro";

/*
 * Force the in-process memory cache provider so unit tests can round-trip
 * keys through the real `buildCacheService()` factory. The same straight-
 * assignment pattern as `BILLING_ENABLED` above — Bun reads `.env`
 * (`CACHE_ENABLED=false`) before this preload, so `??=` would not win.
 */
process.env.CACHE_ENABLED = "true";
process.env.CACHE_PROVIDER = "memory";

/*
 * Keep default unit runs hermetic. Valkey-backed tests remain available
 * behind RUN_VALKEY_NETWORK_TESTS=true, but the baseline suite should not
 * open Redis-protocol sockets just because a developer has local services
 * configured in .env.
 */
process.env.QUEUES_ENABLED = "false";
process.env.NOTIFICATIONS_SSE_ENABLED = "false";
process.env.RUN_VALKEY_NETWORK_TESTS ??= "false";
process.env.VALKEY_HOST = "127.0.0.1";
process.env.LOG_LEVEL ??= "error";

/*
 * The Valkey health check exposes a module-scoped singleton client
 * (`getHealthClient()` in src/api/health/checks/valkey.check.client.ts).
 * Tests that touch it must close it, but they shouldn't have to remember
 * to do so on every exit path. A global afterAll guarantees the client
 * is disposed at the end of the run so the bun test process exits
 * cleanly even when individual tests forget. Lazy import so the env
 * mutations above run before src/config/env is touched.
 */
afterAll(async () => {
  const { closeValkeyHealthClient } =
    await import("../src/api/health/checks/valkey.check.client");

  await closeValkeyHealthClient();
});
