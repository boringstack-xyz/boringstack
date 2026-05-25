/**
 * Integration-test helpers for the application database.
 *
 * Do not assert on `void auditLogService.record(...)` without awaiting the
 * returned promise or polling `audit_log` — fire-and-forget writes race in CI.
 *
 * The pattern: each integration test file imports `requireDb()` and bails
 * silently when no Postgres is reachable (dev runs without docker, CI
 * without a service container, etc.). When the DB *is* available, tests
 * use `cleanDatabase()` in a `beforeEach` to start from a known state.
 *
 * Setup once per machine:
 *   1. Start the dev stack:    (cd ../../infra/compose/compose && ./dev.sh up)
 *   2. Apply schema:           bun run db:push
 *   3. Set `DATABASE_URL`      (already set if you copied .env.example)
 *   4. Run integration tests:  bun test
 *
 * Override the test target by setting `TEST_DATABASE_URL`, or set
 * `REQUIRE_INTEGRATION_DB=true` to force the configured `DATABASE_URL`.
 * This avoids accidentally probing a local dev DB from `.env` during a
 * plain unit-test run.
 */
import { sql } from "drizzle-orm";
import { db } from "../../src/clients/postgres";

/**
 * True when a SELECT 1 succeeds against the configured DATABASE_URL.
 *
 * Result is cached for the test process. The Postgres client uses a short
 * test-mode connect timeout, so an unreachable local dev DB fails cleanly
 * without leaving a background socket attempt that can trip Bun later.
 */
let availabilityCache: boolean | null = null;

const explicitTestDatabaseUrl = (): string | undefined =>
  process.env.TEST_DATABASE_URL ??
  (process.env.REQUIRE_INTEGRATION_DB === "true" || process.env.CI === "true"
    ? process.env.DATABASE_URL
    : undefined);

export const isDbAvailable = async (): Promise<boolean> => {
  if (availabilityCache !== null) {
    return availabilityCache;
  }

  if (explicitTestDatabaseUrl() === undefined) {
    availabilityCache = false;

    return availabilityCache;
  }

  try {
    await db.execute(sql`SELECT 1`);
    availabilityCache = true;
  } catch {
    availabilityCache = false;
  }

  return availabilityCache;
};

/**
 * Skip-guard for integration tests. Use at the top of each test:
 *
 *   test("registers a user", async () => {
 *     if (!(await requireDb())) return;
 *     // ...real assertions
 *   });
 *
 * Logs a one-line skip notice instead of failing so unit suites stay
 * green when the DB isn't available.
 */
let warnedAboutSkip = false;

export const requireDb = async (): Promise<boolean> => {
  if (await isDbAvailable()) {
    return true;
  }

  if (process.env.REQUIRE_INTEGRATION_DB === "true") {
    throw new Error("Integration database is required but unreachable");
  }

  if (!warnedAboutSkip) {
    console.log(
      "(integration tests skipped — DATABASE_URL not set or DB unreachable)"
    );
    warnedAboutSkip = true;
  }

  return false;
};

/**
 * Tables to clear between tests. Order matters — child tables first so
 * foreign keys don't block the truncate. Seed-like tables (`billing.plans`,
 * `billing.features`) are deliberately omitted.
 */
const TRUNCATE_TARGETS = [
  "audit.audit_log",
  "audit.redactions",
  "auth.sessions",
  "auth.email_verification_tokens",
  "auth.password_reset_tokens",
  "auth.user_auth_providers",
  "auth.account_memberships",
  "app.widgets",
  "app.account_feature_overrides",
  "app.account_invitations",
  "app.account_join_requests",
  "billing.stripe_webhook_events",
  "billing.account_plans",
  "notifications.notification_delivery",
  "notifications.notification",
  "notifications.notification_preference",
  "notifications.notification_dedup",
  "notifications.push_subscription",
  "app.accounts",
  "auth.users",
] as const;

/**
 * Wipe user-data tables. Use in `beforeEach` so each test starts with a
 * clean slate. `RESTART IDENTITY` resets sequences; `CASCADE` covers any
 * residual FK dependents we forgot to list.
 */
export const cleanDatabase = async (): Promise<void> => {
  await db.execute(
    sql.raw(`TRUNCATE ${TRUNCATE_TARGETS.join(", ")} RESTART IDENTITY CASCADE`)
  );
};

/** Re-export the live `db` for convenience inside test files. */
export { db };

export { postgresClient } from "../../src/clients/postgres";

/*
 * Re-export drizzle SQL helpers + schema tables so integration tests can
 * assert on DB state without reaching past the helpers entrypoint. The
 * `no-direct-db-in-tests` rule treats this file as the canonical source.
 */
export { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
export {
  accountFeatureOverrides,
  accountInvitations,
  accountJoinRequests,
  accountMemberships,
  accountPlans,
  accounts,
  auditLog,
  authSessions,
  emailVerificationTokens,
  notification,
  notificationDedup,
  notificationDelivery,
  notificationPreference,
  passwordResetTokens,
  pushSubscription,
  planFeatures,
  plans,
  redactions,
  stripeWebhookEvents,
  userAuthProviders,
  users,
  widgets,
} from "../../src/clients/postgres/schema";
export type { IAccount, IAccountMembership } from "../../src/api/accounts";
export type { IUser } from "../../src/api/users/users.types";
