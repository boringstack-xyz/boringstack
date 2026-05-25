import { beforeEach, describe, expect, test } from "bun:test";

import {
  assertAllowedBillingRedirectUrl,
  resolveBillingAccount,
} from "../../../src/api/billing/billing.utils";
import { env } from "../../../src/config/env";
import { ApiError } from "../../../src/lib/errors";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  accountMemberships,
  accounts,
  cleanDatabase,
  db,
  requireDb,
} from "../../helpers/db";

function catchError(fn: () => unknown): unknown {
  try {
    fn();

    return null;
  } catch (error: unknown) {
    return error;
  }
}

describe("assertAllowedBillingRedirectUrl", () => {
  test("accepts a URL whose origin matches FRONTEND_URL", () => {
    expect(() => {
      assertAllowedBillingRedirectUrl(
        `${env.FRONTEND_URL}/billing/success`,
        "successUrl"
      );
    }).not.toThrow();
  });

  test("accepts the root of the frontend origin (no path)", () => {
    expect(() => {
      assertAllowedBillingRedirectUrl(env.FRONTEND_URL, "successUrl");
    }).not.toThrow();
  });

  test("rejects a different origin with a 400 ApiError", () => {
    const caught = catchError(() => {
      assertAllowedBillingRedirectUrl(
        "https://evil.example.com/steal",
        "successUrl"
      );
    });

    if (!(caught instanceof ApiError)) {
      throw new Error("expected ApiError");
    }

    expect(caught.statusCode).toBe(400);
    expect(caught.message).toMatch(/frontend origin/iu);
  });

  test("rejects a same-host, different-scheme URL", () => {
    const httpsValue = env.FRONTEND_URL.startsWith("https://")
      ? env.FRONTEND_URL.replace(/^https:\/\//u, "http://")
      : env.FRONTEND_URL.replace(/^http:\/\//u, "https://");

    const caught = catchError(() => {
      assertAllowedBillingRedirectUrl(httpsValue, "successUrl");
    });

    expect(caught).toBeInstanceOf(ApiError);
  });

  test("rejects an unparseable URL with a 400 ApiError", () => {
    const caught = catchError(() => {
      assertAllowedBillingRedirectUrl("not a url at all", "successUrl");
    });

    if (!(caught instanceof ApiError)) {
      throw new Error("expected ApiError");
    }

    expect(caught.statusCode).toBe(400);
    expect(caught.message).toMatch(/invalid/iu);
  });

  test("rejects the empty string", () => {
    const caught = catchError(() => {
      assertAllowedBillingRedirectUrl("", "successUrl");
    });

    expect(caught).toBeInstanceOf(ApiError);
  });

  test("rejects javascript: pseudo-URLs even though they parse", () => {
    const caught = catchError(() => {
      assertAllowedBillingRedirectUrl(
        "javascript:alert(1)", // eslint-meta-disable-warn
        "successUrl"
      );
    });

    expect(caught).toBeInstanceOf(ApiError);
  });
});

describe("resolveBillingAccount", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("uses the active account id, not the first owner membership", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({
      email: "billing-active-owner@example.com",
    });
    const [secondAccount] = await db
      .insert(accounts)
      .values({ name: "Second account" })
      .returning({ id: accounts.id });

    if (secondAccount === undefined) {
      throw new Error("failed to seed second account");
    }

    await db.insert(accountMemberships).values({
      accountId: secondAccount.id,
      userId: user.id,
      role: "owner",
    });

    const billingAccountId = await resolveBillingAccount(
      user.id,
      secondAccount.id
    );

    expect(billingAccountId).toBe(secondAccount.id);
  });

  test("rejects a non-owner membership on the active account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account } = await seedVerifiedUser({
      email: "billing-owner@example.com",
    });
    const { user } = await seedVerifiedUser({
      email: "billing-member@example.com",
    });

    await db.insert(accountMemberships).values({
      accountId: account.id,
      userId: user.id,
      role: "member",
    });

    let caught: unknown;

    try {
      await resolveBillingAccount(user.id, account.id);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
  });
});
