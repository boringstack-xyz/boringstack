/**
 * F09c: the API enforces no features and no seat limits.
 *
 * The ACL layer exists, is exported, and is tested, and has no production
 * callers at all: `buildAbility` (`src/lib/acl/ability.ts:10`),
 * `requireAbility` (`:76`) and `enforceLimit`
 * (`src/lib/acl/enforce-limit.ts:11`) are re-exported by
 * `src/lib/acl/index.ts:21-22` and imported by nothing in `src`.
 *
 * So the only `can_invite_team` gate in the system is client-side, in
 * `apps/ui/.../InvitationsPage.hooks.ts:33`, and `POST` to the invitation
 * route bypasses it. `max_seats` has no enforcement site anywhere.
 * `enforce-limit.ts:6-10` even documents the intended pattern: "typically
 * inside a transaction with `pg_advisory_xact_lock(hashtext(accountId))`",
 * which no caller implements.
 *
 * These are driven over HTTP against real plan state rather than by reading
 * source. Searching `src` for the feature names would let three TODO
 * comments containing those names turn every case green while the
 * operations stayed unguarded. Text is not enforcement, and a fix that
 * gates correctly through a differently named helper has to pass here.
 *
 * Seats are asserted on committed memberships, not on invitation creation
 * ------------------------------------------------------------------------
 * Sending one invitation against `max_seats: 1` and accepting any status
 * >= 400 would be both too weak and too strong: too weak because a 500 or
 * an unrelated 429 satisfies it, too strong because it forces enforcement
 * to happen at creation, and an implementation that allows pending
 * invitations while refusing the acceptance is equally correct.
 *
 * The invariant is that an account cannot grow past the seats it pays for, so
 * every case here drives a real seat-consuming operation: invitation
 * acceptance, join-request approval, and asserts the committed active
 * membership count. Both operations are covered because they are separate
 * write paths into the same table. If a future policy reserves a seat at
 * invitation time, that is an additional guarantee to specify here, not a
 * replacement for this one.
 *
 * POLICY (ROADMAP decision: server-side entitlement): this assumes feature enforcement belongs on the
 * server. If the flags are meant to be advisory display hints, that has to be
 * stated in the API contract, but the current position, flags that look like
 * entitlements and gate nothing, cannot stand either way.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import {
  computeInvitationExpiresAt,
  normalizeInvitationEmail,
} from "../src/api/accounts/invitations.utils";
import { JOIN_REQUEST_STATUS } from "../src/api/accounts/join-requests.constants";
import { joinRequestsService } from "../src/api/accounts/join-requests.service";
import { createApp } from "../src/config/app/app";
import { generateOpaqueToken, hashOpaqueToken } from "../src/lib/tokens";
import {
  accountInvitations,
  accountJoinRequests,
  accountMemberships,
  accountPlans,
  and,
  cleanDatabase,
  db,
  eq,
  isNull,
  planFeatures,
  plans,
} from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail, specPrecondition } from "./harness";

type App = ReturnType<typeof createApp>;

const PASSWORD = "Hunter2Strong!";
const OWNER = "f09c-owner@gmail.com";

/*
 * A fresh address per call.
 *
 * The invitation route rate-limits by recipient
 * (`accounts.routes.ts:96`, `emailRateLimiter.check(body.email)`), and with
 * the Valkey cache those counters outlive the test process. Reusing a fixed
 * address makes the suite pass or fail depending on how many times it has
 * been run before, which is exactly the kind of result this suite must not
 * produce.
 */
const uniqueEmail = (label: string): string =>
  `f09c-${label}-${crypto.randomUUID().slice(0, 8)}@gmail.com`;

interface IFeatureSet {
  readonly canInviteTeam: boolean;
  readonly maxSeats: number;
}

interface IAccountFixture {
  readonly accountId: string;
  readonly ownerUserId: string;
  readonly ownerMembershipId: string;
  readonly planId: number;
}

/*
 * `cleanDatabase` leaves `billing.plans` and `billing.plan_features` alone,
 * they are reference data, so a plan seeded by an earlier run survives. The
 * feature values are therefore written with an upsert rather than
 * `onConflictDoNothing`: the earlier version silently kept whatever a
 * previous run had left, which is how a seat test can quietly start
 * exercising the wrong cap.
 */
const setFeature = async (
  planId: number,
  featureKey: string,
  value: Record<string, boolean | number>
): Promise<void> => {
  await db
    .insert(planFeatures)
    .values({ planId, featureKey, value })
    .onConflictDoUpdate({
      target: [planFeatures.planId, planFeatures.featureKey],
      set: { value },
    });
};

/** An account whose plan grants exactly the features named. */
const seedAccountWithFeatures = async (
  planName: string,
  features: IFeatureSet
): Promise<IAccountFixture> => {
  const { user, account, membership } = await seedVerifiedUser({
    email: OWNER,
  });

  const [inserted] = await db
    .insert(plans)
    .values({ name: planName, stripePriceId: `price_${planName}` })
    .onConflictDoNothing()
    .returning();

  const [plan] = inserted
    ? [inserted]
    : await db.select().from(plans).where(eq(plans.name, planName));

  specPrecondition(plan !== undefined, "could not seed the plan");

  await setFeature(plan.id, "can_invite_team", {
    bool: features.canInviteTeam,
  });
  await setFeature(plan.id, "max_seats", { number: features.maxSeats });

  await db.insert(accountPlans).values({
    accountId: account.id,
    planId: plan.id,
    status: "active",
    source: "stripe",
    stripeSubscriptionId: `sub_${planName}`,
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });

  return {
    accountId: account.id,
    ownerUserId: user.id,
    ownerMembershipId: membership.id,
    planId: plan.id,
  };
};

/** Committed seats: the number the plan's `max_seats` is a cap on. */
const activeSeats = async (accountId: string): Promise<number> =>
  db
    .select()
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.accountId, accountId),
        isNull(accountMemberships.revokedAt)
      )
    )
    .then((rows) => rows.length);

/** Whether a specific user holds an unrevoked membership in the account. */
const isActiveMember = async (
  accountId: string,
  userId: string
): Promise<boolean> =>
  db
    .select()
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.accountId, accountId),
        eq(accountMemberships.userId, userId),
        isNull(accountMemberships.revokedAt)
      )
    )
    .then((rows) => rows.length === 1);

const login = async (app: App, email: string): Promise<string> => {
  const res = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  const setCookie = res.headers.getAll("set-cookie").join("; ");

  specPrecondition(
    setCookie !== "",
    `login issued no cookies (status ${res.status})`
  );

  return setCookie
    .split(/,\s*(?=[^;]+=)/)
    .map((chunk) => chunk.split(";")[0])
    .join("; ");
};

/**
 * A refusal only counts as quota enforcement if it is a domain refusal.
 *
 * 429 is the rate limiter and 5xx is a crash. 404 means the route or the row
 * was not found and 401 means the session never attached, a seat assertion
 * is trivially satisfied by an operation that never ran, so a fixture that
 * drifted into calling nothing would look like a passing cap check. All four
 * are raised as infrastructure, which the reconciler reports as a broken run
 * rather than as evidence.
 *
 * 403 stays allowed: the account owner really does hold the role, so a
 * forbidden here is a plausible shape for a quota refusal. The allowed-path
 * control on each operation is what rules out a permanently refusing route.
 */
const rejectInfrastructure = (status: number, what: string): void => {
  specPrecondition(status !== 429, `${what} was rate-limited (429)`);
  specPrecondition(status !== 401, `${what} was unauthenticated (401)`);
  specPrecondition(status !== 404, `${what} hit no route or no row (404)`);
  specPrecondition(status < 500, `${what} failed with ${status}`);
};

const invite = async (
  app: App,
  cookie: string,
  accountId: string,
  email: string
): Promise<number> => {
  const res = await app.handle(
    new Request(`http://localhost/api/v1/accounts/${accountId}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email, roleToAssign: "member" }),
    })
  );

  return res.status;
};

/**
 * Seeds a valid outstanding invitation and its recipient, writing the row
 * directly rather than calling `invitationsService.create`.
 *
 * Going through the service instead would only bypass the route-level
 * gate. Enforcing quota inside the service is a perfectly good
 * implementation, and under it the fixture throws at capacity and the
 * acceptance case never reaches the operation it exists to test. Creation
 * policy has its own cases; this one has to present an invitation that is
 * already outstanding, however it got there, issued before a downgrade,
 * before a member was added, or under an older policy.
 *
 * The row is built from the same helpers `create` uses, so the token hash,
 * normalisation and expiry match what acceptance expects.
 */
const seedOutstandingInvitation = async (
  fixture: IAccountFixture,
  label: string
): Promise<{ email: string; rawToken: string }> => {
  const email = uniqueEmail(label);
  const rawToken = generateOpaqueToken();

  await seedVerifiedUser({ email });

  await db.insert(accountInvitations).values({
    accountId: fixture.accountId,
    email: normalizeInvitationEmail(email),
    roleToAssign: "member",
    tokenHash: hashOpaqueToken(rawToken),
    invitedByMembershipId: fixture.ownerMembershipId,
    expiresAt: computeInvitationExpiresAt(),
  });

  return { email, rawToken };
};

const seedPendingJoinRequest = async (
  accountId: string,
  label: string
): Promise<{ userId: string; requestId: string }> => {
  const email = uniqueEmail(label);
  const { user } = await seedVerifiedUser({ email });

  const { id } = await joinRequestsService.createPending({
    accountId,
    userId: user.id,
    email,
  });

  return { userId: user.id, requestId: id };
};

const acceptInvitation = async (
  app: App,
  cookie: string,
  token: string
): Promise<number> => {
  const res = await app.handle(
    new Request("http://localhost/api/v1/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ token }),
    })
  );

  return res.status;
};

const approveJoinRequest = async (
  app: App,
  cookie: string,
  accountId: string,
  requestId: string
): Promise<number> => {
  const res = await app.handle(
    new Request(
      `http://localhost/api/v1/accounts/${accountId}/join-requests/${requestId}/approve`,
      { method: "POST", headers: { cookie } }
    )
  );

  return res.status;
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F09c feature and seat enforcement", () => {
  test("inviting is refused when the plan withholds can_invite_team", async () => {
    const { accountId } = await seedAccountWithFeatures("f09c-basic", {
      canInviteTeam: false,
      maxSeats: 5,
    });

    const app = createApp();
    const cookie = await login(app, OWNER);

    const status = await invite(app, cookie, accountId, uniqueEmail("invitee"));

    /*
     * The owner has the role, so the route's role check passes. The plan does
     * not grant the feature, so entitlement must refuse it. 403, not 200.
     */
    expect(status).toBe(403);
  });

  test("control: inviting succeeds when the plan grants it", async () => {
    const { accountId } = await seedAccountWithFeatures("f09c-team", {
      canInviteTeam: true,
      maxSeats: 5,
    });

    const app = createApp();
    const cookie = await login(app, OWNER);

    const status = await invite(app, cookie, accountId, uniqueEmail("allowed"));

    /*
     * Proves the route, the fixture and the auth cookie all work, so the
     * refusal above is about entitlement rather than a broken request.
     * Gating must not break paying accounts, so this stays green.
     */
    expect(status).toBeLessThan(400);
  });

  test("accepting an invitation cannot take the account past max_seats", async () => {
    const fixture = await seedAccountWithFeatures("f09c-seat-accept", {
      canInviteTeam: true,
      maxSeats: 1,
    });

    const { email, rawToken } = await seedOutstandingInvitation(
      fixture,
      "accept"
    );

    specPrecondition(
      (await activeSeats(fixture.accountId)) === 1,
      "the owner should occupy the only seat before acceptance"
    );

    const app = createApp();
    const status = await acceptInvitation(
      app,
      await login(app, email),
      rawToken
    );

    rejectInfrastructure(status, "invitation acceptance");

    /*
     * The single assertion that matters: whatever the route answered, the
     * account must not have grown past the seat it pays for.
     */
    expect(await activeSeats(fixture.accountId)).toBeLessThanOrEqual(1);
  });

  test("approving a join request cannot take the account past max_seats", async () => {
    const fixture = await seedAccountWithFeatures("f09c-seat-join", {
      canInviteTeam: true,
      maxSeats: 1,
    });

    const { requestId } = await seedPendingJoinRequest(
      fixture.accountId,
      "joiner"
    );

    const app = createApp();
    const status = await approveJoinRequest(
      app,
      await login(app, OWNER),
      fixture.accountId,
      requestId
    );

    rejectInfrastructure(status, "join-request approval");

    /*
     * Approval is a second, independent write path into
     * `account_memberships` (`join-requests.service.ts:145`). Gating only the
     * invitation flow would leave this one open.
     */
    expect(await activeSeats(fixture.accountId)).toBeLessThanOrEqual(1);
  });

  test("control: an approval within the cap admits the joiner", async () => {
    const fixture = await seedAccountWithFeatures("f09c-join-room", {
      canInviteTeam: true,
      maxSeats: 5,
    });

    const { userId, requestId } = await seedPendingJoinRequest(
      fixture.accountId,
      "join-allowed"
    );

    const app = createApp();
    const status = await approveJoinRequest(
      app,
      await login(app, OWNER),
      fixture.accountId,
      requestId
    );

    rejectInfrastructure(status, "approval within the cap");

    const [request] = await db
      .select()
      .from(accountJoinRequests)
      .where(eq(accountJoinRequests.id, requestId));

    /*
     * Approval has its own control because it has its own route and its own
     * service. Without this, a route that 403s every approval, removed,
     * misrouted, or broken in some future refactor, would satisfy the cap
     * case above while the acceptance control stayed green, and the suite
     * would report seat enforcement it had never exercised.
     */
    expect(await isActiveMember(fixture.accountId, userId)).toBe(true);
    expect(await activeSeats(fixture.accountId)).toBe(2);
    expect(request?.status).toBe(JOIN_REQUEST_STATUS.approved);
  });

  test("acceptances racing for the last seat cannot all win", async () => {
    const fixture = await seedAccountWithFeatures("f09c-seat-race", {
      canInviteTeam: true,
      maxSeats: 2,
    });

    /*
     * One free seat, four claimants.
     *
     * What this proves and what it does not. Today nothing counts seats at
     * all, so every acceptance commits and the case fails on a real
     * over-subscription. Against a *fixed* implementation it is a probe, not
     * a proof: `Promise.all` starts four requests, it does not guarantee that
     * all four read capacity before any of them writes, so a count-then-insert
     * with no advisory lock (`enforce-limit.ts:6-10` documents the one this
     * needs) can survive a lucky run. Four claimants rather than two widens
     * the window; it does not close it.
     *
     * Closing it needs what F12 does, a schedule imposed with a row lock,
     * and that cannot be written until there is an implementation to
     * interleave with. Noted in the README's uncovered list so a green run
     * here is not read as proof the fix is race-free.
     */
    const claimants = await Promise.all([
      seedOutstandingInvitation(fixture, "race-a"),
      seedOutstandingInvitation(fixture, "race-b"),
      seedOutstandingInvitation(fixture, "race-c"),
      seedOutstandingInvitation(fixture, "race-d"),
    ]);

    const app = createApp();
    const cookies = await Promise.all(
      claimants.map(async (claimant) => login(app, claimant.email))
    );

    const statuses = await Promise.all(
      claimants.map(async (claimant, index) =>
        acceptInvitation(app, cookies[index] ?? "", claimant.rawToken)
      )
    );

    statuses.forEach((status, index) => {
      rejectInfrastructure(status, `concurrent acceptance ${index + 1}`);
    });

    expect(await activeSeats(fixture.accountId)).toBeLessThanOrEqual(2);
  });

  test("an invitation issued before a downgrade cannot exceed the new cap", async () => {
    const fixture = await seedAccountWithFeatures("f09c-seat-downgrade", {
      canInviteTeam: true,
      maxSeats: 5,
    });

    const { email, rawToken } = await seedOutstandingInvitation(
      fixture,
      "downgrade"
    );

    // The account drops to a plan that fits the owner and nobody else.
    await setFeature(fixture.planId, "max_seats", { number: 1 });

    const app = createApp();
    const status = await acceptInvitation(
      app,
      await login(app, email),
      rawToken
    );

    rejectInfrastructure(status, "acceptance after the downgrade");

    /*
     * Enforcing only at issue time would let every invitation outstanding at
     * the moment of a downgrade land afterwards, which is the cheapest way to
     * exceed a cap and needs no race at all.
     */
    expect(await activeSeats(fixture.accountId)).toBeLessThanOrEqual(1);
  });

  test("control: an acceptance within the cap consumes a seat", async () => {
    const fixture = await seedAccountWithFeatures("f09c-seat-room", {
      canInviteTeam: true,
      maxSeats: 5,
    });

    const { email, rawToken } = await seedOutstandingInvitation(
      fixture,
      "within-cap"
    );

    const app = createApp();
    const status = await acceptInvitation(
      app,
      await login(app, email),
      rawToken
    );

    rejectInfrastructure(status, "acceptance within the cap");

    /*
     * The allowed path. Without this, every seat assertion above could be
     * satisfied by an implementation that refuses all acceptances, and the
     * fixture would look correct while proving nothing.
     */
    expect(await activeSeats(fixture.accountId)).toBe(2);
  });

  test("the account plan actually carries the seeded features", async () => {
    const { accountId } = await seedAccountWithFeatures("f09c-check", {
      canInviteTeam: false,
      maxSeats: 3,
    });

    const { resolveAccountFeatures } =
      await import("../src/lib/acl/resolve-account-features");

    const features = await resolveAccountFeatures(accountId);

    /*
     * Guards the fixture itself: if the plan did not actually withhold
     * `can_invite_team` or carry the cap, the assertions above would be
     * meaningless.
     */
    expect(features.can_invite_team).toBe(false);
    expect(features.max_seats).toBe(3);
  });
});
