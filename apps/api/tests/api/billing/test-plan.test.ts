/**
 * The end-to-end fixtures buy a team plan through the API rather than
 * writing a membership row into Postgres, so the browser suite still runs
 * the policy the invitation route applies. That only works if the grant
 * really lifts the gate, and if the route behind it stays unreachable
 * without a session.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { grantTestTeamPlan } from "../../../src/api/billing/test-plan";
import { requireFeature } from "../../../src/lib/acl/enforce-entitlement";
import { createApp } from "../../../src/config/app/app";
import { seedVerifiedUser } from "../../helpers/auth";
import { cleanDatabase, requireDb } from "../../helpers/db";

const canInvite = async (accountId: string): Promise<string> =>
  requireFeature(accountId, "can_invite_team")
    .then(() => "allowed")
    .catch(() => "refused");

describe("grantTestTeamPlan", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("lifts the can_invite_team gate", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({
      email: "grant-plan@example.com",
    });

    expect(await canInvite(account.id)).toBe("refused");

    await grantTestTeamPlan(account.id);

    expect(await canInvite(account.id)).toBe("allowed");
  });

  test("is idempotent", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({
      email: "grant-plan-twice@example.com",
    });

    await grantTestTeamPlan(account.id);
    await grantTestTeamPlan(account.id);

    expect(await canInvite(account.id)).toBe("allowed");
  });

  test("the route is unreachable without a session", async () => {
    const res = await createApp().handle(
      new Request("http://localhost/api/v1/billing/__test/grant-team-plan", {
        method: "POST",
      })
    );

    /*
     * The env flag only decides whether the handler runs. Authentication
     * comes first, so an unauthenticated caller never reaches the grant
     * even where the endpoint is switched on.
     */
    expect(res.status).toBe(401);
  });
});
