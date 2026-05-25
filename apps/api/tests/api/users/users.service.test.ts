import { beforeEach, describe, expect, test } from "bun:test";

import { adminBillingService } from "../../../src/api/admin/admin-billing.service";
import { getBillingService } from "../../../src/api/billing/billing.service";
import { seedVerifiedUser } from "../../helpers/auth";
import { usersService } from "../../../src/api/users/users.service";
import { env } from "../../../src/config/env";
import { ApiError } from "../../../src/lib/errors";
import {
  accountFeatureOverrides,
  accountPlans,
  and,
  cleanDatabase,
  db,
  eq,
  isNull,
  planFeatures,
  plans,
  requireDb,
  users,
} from "../../helpers/db";

const ensurePlansForGetMe = async (): Promise<{
  free: number;
  pro: number;
}> => {
  await getBillingService().listPlans();

  const free = await db.query.plans.findFirst({
    where: eq(plans.name, "Free"),
  });
  const pro = await db.query.plans.findFirst({
    where: eq(plans.name, "Pro"),
  });

  if (!free || !pro) {
    throw new Error("plans not seeded");
  }

  return { free: free.id, pro: pro.id };
};

const PASSWORD = "Hunter2Strong!";

async function seedUser(email = "users-svc@example.com"): Promise<string> {
  const { user } = await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Users",
    lastName: "Tester",
  });

  return user.id;
}

describe("UsersService.getById", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns the user row when the id exists", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const user = await usersService.getById(userId);

    expect(user?.id).toBe(userId);
    expect(user?.email).toBe("users-svc@example.com");
  });

  test("returns undefined for an unknown id", async () => {
    if (!(await requireDb())) {
      return;
    }

    const user = await usersService.getById(
      "00000000-0000-0000-0000-000000000000"
    );

    expect(user).toBeUndefined();
  });
});

describe("UsersService.getProfile", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns the public profile shape (no password hash, etc.)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const profile = await usersService.getProfile(userId);

    expect(profile.id).toBe(userId);
    expect(profile.email).toBe("users-svc@example.com");
    expect(profile.firstName).toBe("Users");
    expect("passwordHash" in profile).toBe(false);
  });

  test("throws notFound for an unknown id", async () => {
    if (!(await requireDb())) {
      return;
    }

    let caught: unknown;

    try {
      await usersService.getProfile("00000000-0000-0000-0000-000000000000");
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error("expected ApiError");
    }

    expect(caught.statusCode).toBe(404);
  });
});

describe("UsersService.updateProfile", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("persists the updates and bumps updatedAt", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser();
    const before = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const updated = await usersService.updateProfile(userId, {
      firstName: "Renamed",
      lastName: "Person",
    });

    expect(updated.firstName).toBe("Renamed");
    expect(updated.lastName).toBe("Person");

    const after = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    expect(after?.firstName).toBe("Renamed");
    expect(after?.updatedAt).not.toBe(before?.updatedAt);
  });

  test("throws notFound when the user does not exist", async () => {
    if (!(await requireDb())) {
      return;
    }

    let caught: unknown;

    try {
      await usersService.updateProfile("00000000-0000-0000-0000-000000000000", {
        firstName: "Ghost",
      });
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error("expected ApiError");
    }

    expect(caught.statusCode).toBe(404);
  });
});

describe("UsersService.create", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("creates a user with the provided data", async () => {
    if (!(await requireDb())) {
      return;
    }

    const created = await usersService.create({
      email: "new-user@example.com",
      firstName: "New",
      lastName: "User",
    });

    expect(created.email).toBe("new-user@example.com");
    expect(created.firstName).toBe("New");
    expect(created.lastName).toBe("User");
  });
});

describe("UsersService.getMe — feature resolution", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns catalog defaults when the account has no plan row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "me-defaults@example.com",
    });

    const me = await usersService.getMe(user.id, account.id);

    expect(me.features.max_seats).toBe(1);
    expect(me.features.max_widgets).toBe(5);
    expect(me.capabilities.billing).toBe(env.BILLING_ENABLED);
  });

  test("reflects Pro plan features from plan_features rows", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "me-pro@example.com",
    });
    const { pro } = await ensurePlansForGetMe();

    await db
      .insert(planFeatures)
      .values({
        planId: pro,
        featureKey: "max_widgets",
        value: { number: 1000 },
      })
      .onConflictDoUpdate({
        target: [planFeatures.planId, planFeatures.featureKey],
        set: { value: { number: 1000 } },
      });

    await db.insert(accountPlans).values({
      accountId: account.id,
      planId: pro,
      status: "active",
      source: "stripe",
    });

    const me = await usersService.getMe(user.id, account.id);

    expect(me.features.max_widgets).toBe(1000);
  });

  test("admin override wins over the plan row on the next getMe", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account, membership } = await seedVerifiedUser({
      email: "me-override@example.com",
      isPlatformAdmin: true,
    });
    const { free } = await ensurePlansForGetMe();

    await db.insert(accountPlans).values({
      accountId: account.id,
      planId: free,
      status: "active",
      source: "stripe",
    });

    await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "max_widgets",
      value: { number: 99 },
      expiresAt: null,
      visibility: "internal",
      reason: "test override",
      grantedByUserId: user.id,
      grantedByMembershipId: membership.id,
    });

    const me = await usersService.getMe(user.id, account.id);

    expect(me.features.max_widgets).toBe(99);
  });

  test("revoked overrides fall back to plan defaults", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account, membership } = await seedVerifiedUser({
      email: "me-revoked@example.com",
      isPlatformAdmin: true,
    });
    const { free } = await ensurePlansForGetMe();

    await db
      .insert(planFeatures)
      .values({
        planId: free,
        featureKey: "max_widgets",
        value: { number: 10 },
      })
      .onConflictDoUpdate({
        target: [planFeatures.planId, planFeatures.featureKey],
        set: { value: { number: 10 } },
      });

    await db.insert(accountPlans).values({
      accountId: account.id,
      planId: free,
      status: "active",
      source: "stripe",
    });

    const granted = await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "max_widgets",
      value: { number: 99 },
      expiresAt: null,
      visibility: "internal",
      reason: "temporary",
      grantedByUserId: user.id,
      grantedByMembershipId: membership.id,
    });

    await adminBillingService.revokeFeature({
      overrideId: granted.id,
      revokedByUserId: user.id,
      reason: "done",
    });

    const activeOverrides = await db
      .select()
      .from(accountFeatureOverrides)
      .where(
        and(
          eq(accountFeatureOverrides.accountId, account.id),
          isNull(accountFeatureOverrides.revokedAt)
        )
      );

    expect(activeOverrides).toHaveLength(0);

    const me = await usersService.getMe(user.id, account.id);

    expect(me.features.max_widgets).toBe(10);
  });
});
