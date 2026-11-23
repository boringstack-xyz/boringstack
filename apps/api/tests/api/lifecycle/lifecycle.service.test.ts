import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { lifecycleService } from "../../../src/api/lifecycle/lifecycle.service";
import { signUnsubscribeToken } from "../../../src/api/lifecycle/lifecycle.utils";
import { env } from "../../../src/config/env";
import { notifications } from "../../../src/lib/notifications/dispatch/notifications.dispatcher";
import {
  accountMemberships,
  accountPlans,
  accounts,
  authSessions,
  cleanDatabase,
  db,
  eq,
  notificationPreference,
  plans,
  requireDb,
  users,
} from "../../helpers/db";

const DAY_MS = 86_400_000;
const daysAgo = (days: number): string =>
  new Date(Date.now() - days * DAY_MS).toISOString();

interface ISeed {
  email: string;
  createdDaysAgo?: number;
  verified?: boolean;
  admin?: boolean;
}

const seedUser = async (seed: ISeed): Promise<string> => {
  const createdAt = daysAgo(seed.createdDaysAgo ?? 3);
  const [row] = await db
    .insert(users)
    .values({
      email: seed.email,
      firstName: "Sam",
      lastName: "Test",
      createdAt,
      updatedAt: createdAt,
      emailVerifiedAt: seed.verified === false ? null : createdAt,
      isPlatformAdmin: seed.admin ?? false,
    })
    .returning({ id: users.id });

  if (!row) {
    throw new Error("Failed to insert lifecycle test user");
  }

  return row.id;
};

const candidateIds = async (): Promise<string[]> => {
  const rows = await lifecycleService.candidates("welcome-follow-up");

  return rows.map((row) => row.userId);
};

describe("lifecycleService.candidates (welcome-follow-up)", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("selects a verified sign-up from two to seven days ago that has not been back", async () => {
    if (!(await requireDb())) {
      return;
    }

    const eligible = await seedUser({ email: "eligible@example.com" });

    expect(await candidateIds()).toEqual([eligible]);
  });

  test("never selects the verification robot, admins, the unverified or the too-new", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedUser({
      email: "robot-7@robot.boringstack.invalid",
    });
    await seedUser({ email: "admin@example.com", admin: true });
    await seedUser({ email: "unverified@example.com", verified: false });
    await seedUser({ email: "new@example.com", createdDaysAgo: 1 });

    expect(await candidateIds()).toEqual([]);
  });

  test("skips a person who has a session touched in the last two days", async () => {
    if (!(await requireDb())) {
      return;
    }

    const back = await seedUser({ email: "back@example.com" });

    await db.insert(authSessions).values({
      userId: back,
      tokenHash: "a".repeat(64),
      expiresAt: daysAgo(-30),
      updatedAt: daysAgo(0),
    });

    expect(await candidateIds()).toEqual([]);
  });

  test("skips anyone on a paid plan", async () => {
    if (!(await requireDb())) {
      return;
    }

    const payer = await seedUser({ email: "payer@example.com" });
    const [pro] = await db
      .insert(plans)
      .values({
        name: "test-lifecycle-paid",
        stripePriceId: "price_test_lifecycle_paid",
      })
      .onConflictDoUpdate({
        target: plans.name,
        set: { stripePriceId: "price_test_lifecycle_paid" },
      })
      .returning({ id: plans.id });

    if (!pro) {
      throw new Error("Failed to insert a paid test plan");
    }

    const [account] = await db
      .insert(accounts)
      .values({ name: "Payer workspace" })
      .returning({ id: accounts.id });

    if (!account) {
      throw new Error("Failed to insert account");
    }

    await db.insert(accountMemberships).values({
      accountId: account.id,
      userId: payer,
      role: "owner",
    });
    await db.insert(accountPlans).values({
      accountId: account.id,
      planId: pro.id,
      status: "active",
      source: "stripe",
    });

    expect(await candidateIds()).toEqual([]);
  });
});

describe("lifecycleService sweep and unsubscribe", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("the sweep sends nothing while LIFECYCLE_EMAILS_ENABLED is off", async () => {
    if (!(await requireDb())) {
      return;
    }

    expect(env.LIFECYCLE_EMAILS_ENABLED).toBe(false);
    await seedUser({ email: "eligible-sweep@example.com" });

    const send = spyOn(notifications, "send");

    try {
      const result = await lifecycleService.sweep();

      expect(result.sent["welcome-follow-up"]).toBe(0);
      expect(send).not.toHaveBeenCalled();
    } finally {
      send.mockRestore();
    }
  });

  test("a valid unsubscribe turns the stage off for both channels and removes the person from the candidates", async () => {
    if (!(await requireDb())) {
      return;
    }

    const id = await seedUser({ email: "unsub@example.com" });
    const token = signUnsubscribeToken(id, env.JWT_SECRET);

    expect(await lifecycleService.unsubscribe(token)).toBe(true);

    const prefs = await db
      .select({
        channel: notificationPreference.channel,
        enabled: notificationPreference.enabled,
      })
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, id));

    expect(prefs.map((row) => row.channel).sort()).toEqual(["email", "in-app"]);
    expect(prefs.every((row) => !row.enabled)).toBe(true);
    expect(await candidateIds()).toEqual([]);
  });

  test("a token that does not verify changes nothing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const id = await seedUser({ email: "forged@example.com" });
    const forged = signUnsubscribeToken(id, "z".repeat(32));

    expect(await lifecycleService.unsubscribe(forged)).toBe(false);
    expect(await candidateIds()).toEqual([id]);
  });
});
