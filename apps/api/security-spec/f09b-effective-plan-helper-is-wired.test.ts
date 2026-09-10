/**
 * F09b — the runtime resolver does not apply effective-plan semantics.
 *
 * `selectEffectiveFeatures` (`src/api/billing/account-plan-status.ts:17`) has
 * a doc comment describing it as what "the resolver should treat as the
 * 'effective plan'". It has ten call sites in its own test file and none in
 * `src`. `resolveAccountFeatures` — the one resolver with a production caller
 * — selects on `revokedAt IS NULL` alone (`resolve-account-features.ts:25-30`)
 * and never consults `status`, `currentPeriodEnd` or `expiresAt`.
 *
 * A passing unit-test suite for an uncalled helper reads as assurance that
 * status-to-entitlement mapping is enforced. Nothing enforces it.
 *
 * These assert the behaviour rather than the wiring. Searching `src` for
 * the helper's name would be satisfied by a comment and failed by an
 * equivalent fix under a different name. Any resolver that honours expiry
 * passes here, however it is built.
 *
 * The sibling case F09a covers Stripe status values. This one covers the two
 * time-based boundaries: an administrative grant past its `expiresAt`, and a
 * canceled subscription whose paid period has elapsed. The hourly sweeper
 * (`account-maintenance.jobs.ts:76-94`) eventually revokes the second, so
 * this is specifically about resolution in the window before it runs.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { resolveAccountFeatures } from "../src/lib/acl/resolve-account-features";
import {
  accountPlans,
  cleanDatabase,
  db,
  eq,
  planFeatures,
  plans,
} from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail, specPrecondition } from "./harness";

const PLAN_NAME = "spec-f09b";
const DAY_MS = 86_400_000;

interface IPlanState {
  readonly status: string;
  readonly source: string;
  readonly currentPeriodEnd?: string | null;
  readonly expiresAt?: string | null;
}

/** An account on a paid plan in the given lifecycle state. */
const seedPlanState = async (
  email: string,
  state: IPlanState
): Promise<string> => {
  const { account } = await seedVerifiedUser({ email });

  const [inserted] = await db
    .insert(plans)
    .values({ name: PLAN_NAME, stripePriceId: "price_spec_f09b" })
    .onConflictDoNothing()
    .returning();

  const [plan] = inserted
    ? [inserted]
    : await db.select().from(plans).where(eq(plans.name, PLAN_NAME));

  specPrecondition(plan !== undefined, "could not seed the plan");

  await db
    .insert(planFeatures)
    .values({
      planId: plan.id,
      featureKey: "can_export",
      value: { bool: true },
    })
    .onConflictDoNothing();

  await db.insert(accountPlans).values({
    accountId: account.id,
    planId: plan.id,
    status: state.status,
    source: state.source,
    stripeSubscriptionId: state.source === "stripe" ? "sub_spec_f09b" : "",
    currentPeriodEnd: state.currentPeriodEnd ?? null,
    expiresAt: state.expiresAt ?? null,
  });

  return account.id;
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F09b effective-plan semantics are applied at resolution", () => {
  test("an administrative grant past its expiry grants nothing", async () => {
    const accountId = await seedPlanState("f09b-expired@gmail.com", {
      status: "active",
      source: "admin_grant",
      expiresAt: new Date(Date.now() - DAY_MS).toISOString(),
    });

    const features = await resolveAccountFeatures(accountId);

    /*
     * `expiresAt` is the whole point of an administrative grant. A resolver
     * that ignores it hands out paid features forever.
     */
    expect(features.can_export).toBe(false);
  });

  test("a canceled subscription past its paid period grants nothing", async () => {
    const accountId = await seedPlanState("f09b-elapsed@gmail.com", {
      status: "canceled",
      source: "stripe",
      currentPeriodEnd: new Date(Date.now() - DAY_MS).toISOString(),
    });

    const features = await resolveAccountFeatures(accountId);

    /*
     * The sweeper revokes this within the hour. Until it runs, resolution
     * must not grant it — the window is the defect, not the sweep.
     */
    expect(features.can_export).toBe(false);
  });

  test("control: a live grant inside its window still grants", async () => {
    const accountId = await seedPlanState("f09b-live@gmail.com", {
      status: "active",
      source: "admin_grant",
      expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
    });

    const features = await resolveAccountFeatures(accountId);

    /*
     * Proves the fixture actually grants the feature, so the two denials
     * above are about expiry rather than an empty plan. It must stay green.
     */
    expect(features.can_export).toBe(true);
  });
});
