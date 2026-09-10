/**
 * Tests for the server-side entitlement checks.
 *
 * `requireFeature` and `enforceSeatAvailable` are the only things standing
 * between a plan's feature flags and an account that ignores them, so they
 * need cases of their own rather than only being exercised through the
 * routes that call them.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import {
  enforceSeatAvailable,
  requireFeature,
} from "../../../src/lib/acl/enforce-entitlement";
import {
  accountMemberships,
  cleanDatabase,
  db,
  requireDb,
} from "../../helpers/db";
import { now } from "../../../src/lib/time/now";
import { grantTeamPlan, seedVerifiedUser } from "../../helpers/auth";

const OWNER = "entitlement@example.com";

describe("requireFeature", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("passes when the plan grants the feature", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({ email: OWNER });

    await grantTeamPlan({ accountId: account.id });

    expect(
      await requireFeature(account.id, "can_invite_team")
        .then(() => "allowed")
        .catch(() => "refused")
    ).toBe("allowed");
  });

  test("refuses when the plan withholds it", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({ email: OWNER });

    await grantTeamPlan({ accountId: account.id, canInviteTeam: false });

    expect(
      await requireFeature(account.id, "can_invite_team")
        .then(() => "allowed")
        .catch(() => "refused")
    ).toBe("refused");
  });

  test("refuses an account with no plan at all", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({ email: OWNER });

    /*
     * `can_invite_team` defaults to false, so an unsubscribed account is
     * refused. Defaulting the other way would make every entitlement
     * optional in practice.
     */
    expect(
      await requireFeature(account.id, "can_invite_team")
        .then(() => "allowed")
        .catch(() => "refused")
    ).toBe("refused");
  });
});

describe("enforceSeatAvailable", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("allows a seat while the account is below its cap", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({ email: OWNER });

    await grantTeamPlan({ accountId: account.id, maxSeats: 3 });

    const outcome = await db
      .transaction(async (tx) => {
        await enforceSeatAvailable(tx, account.id);

        return "allowed";
      })
      .catch(() => "refused");

    expect(outcome).toBe("allowed");
  });

  test("refuses once the active memberships reach the cap", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({ email: OWNER });

    // One seat, already taken by the owner.
    await grantTeamPlan({ accountId: account.id, maxSeats: 1 });

    const outcome = await db
      .transaction(async (tx) => {
        await enforceSeatAvailable(tx, account.id);

        return "allowed";
      })
      .catch(() => "refused");

    expect(outcome).toBe("refused");
  });

  test("counts only unrevoked memberships", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, user } = await seedVerifiedUser({ email: OWNER });
    const { user: second } = await seedVerifiedUser({
      email: "second@example.com",
    });

    await grantTeamPlan({ accountId: account.id, maxSeats: 2 });

    await db.insert(accountMemberships).values({
      accountId: account.id,
      userId: second.id,
      role: "member",
      revokedAt: now(),
    });

    /*
     * Two membership rows, one of them revoked. A revoked member has given
     * their seat back, so the cap of 2 still has room for the owner plus
     * one more.
     */
    expect(user.id).toBeString();

    const outcome = await db
      .transaction(async (tx) => {
        await enforceSeatAvailable(tx, account.id);

        return "allowed";
      })
      .catch(() => "refused");

    expect(outcome).toBe("allowed");
  });
});
