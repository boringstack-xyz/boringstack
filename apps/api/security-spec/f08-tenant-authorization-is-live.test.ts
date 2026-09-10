/**
 * F08: tenant authorization is inconsistent after membership changes.
 *
 * `billing.routes.ts:33-35` reads the subscription straight off the token:
 *
 *   .get("/subscription", async ({ accountId }) =>
 *     getBillingService().getSubscription(accountId), { ... })
 *
 * `accountId` comes from the JWT (`auth.plugin.ts:136`), and `requireAuth`
 * checks signature, expiry and revocation, never membership. The billing
 * module imports no membership resolver for this route. A removed member
 * keeps reading the account's billing data until their access token expires.
 *
 * The contrast is the tell: the mutations right next to it do it correctly.
 * Checkout (`:48-51`) and portal (`:74-77`) both call `resolveBillingAccount`,
 * which runs `resolveFreshMembership` plus an owner check
 * (`billing.utils.ts:12-18`). The pattern exists in the same file; the read
 * simply does not use it.
 *
 * Exposure is bounded by the 15-minute access-token lifetime and the data is
 * plan name and status rather than card details, which is why this is Medium
 * rather than High. It is still an authorization boundary that a removed
 * member can cross.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { now } from "../src/lib/time/now";
import { createApp } from "../src/config/app/app";
import {
  accountMemberships,
  and,
  cleanDatabase,
  db,
  eq,
} from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail } from "./harness";

const MEMBER = "f08-member@example.com";
const PASSWORD = "Hunter2Strong!";

/** Logs in through the real route and returns the session cookie header. */
const login = async (
  app: ReturnType<typeof createApp>,
  email: string
): Promise<string> => {
  const res = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  const setCookie = res.headers.getAll("set-cookie").join("; ");

  if (setCookie === "") {
    throw new Error(`f08: login did not issue cookies (status ${res.status})`);
  }

  return setCookie
    .split(/,\s*(?=[^;]+=)/)
    .map((chunk) => chunk.split(";")[0])
    .join("; ");
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F08 tenant authorization is live", () => {
  test("a removed member cannot read the account subscription", async () => {
    const { user, account } = await seedVerifiedUser({ email: MEMBER });
    const app = createApp();

    const cookie = await login(app, MEMBER);

    // Access is revoked while the token is still within its lifetime.
    await db
      .update(accountMemberships)
      .set({ revokedAt: now() })
      .where(
        and(
          eq(accountMemberships.userId, user.id),
          eq(accountMemberships.accountId, account.id)
        )
      );

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/subscription", {
        headers: { cookie },
      })
    );

    expect(res.status).toBe(403);
  });

  test("control: a current member can read it", async () => {
    await seedVerifiedUser({ email: "f08-ok@example.com" });
    const app = createApp();

    const cookie = await login(app, "f08-ok@example.com");

    const res = await app.handle(
      new Request("http://localhost/api/v1/billing/subscription", {
        headers: { cookie },
      })
    );

    expect(res.status).toBe(200);
  });
});
