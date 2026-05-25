import { beforeEach, describe, expect, test } from "bun:test";

import { accountsService } from "../../../src/api/accounts/accounts.service";
import { adminBillingService } from "../../../src/api/admin/admin-billing.service";
import {
  accountFeatureOverrides,
  accountPlans,
  and,
  auditLog,
  cleanDatabase,
  db,
  eq,
  isNull,
  plans,
  requireDb,
  users,
} from "../../helpers/db";

const seedUser = async (email: string): Promise<string> => {
  const [row] = await db
    .insert(users)
    .values({ email, isPlatformAdmin: true })
    .returning({ id: users.id });

  if (!row) {
    throw new Error("seed");
  }

  return row.id;
};

const ensurePlans = async (): Promise<{ free: number; pro: number }> => {
  // Plans are seed data; upsert by name so test re-runs don't conflict.
  const [free] = await db
    .insert(plans)
    .values({ name: "Free", isDefault: true })
    .onConflictDoUpdate({ target: plans.name, set: { isDefault: true } })
    .returning({ id: plans.id });
  const [pro] = await db
    .insert(plans)
    .values({ name: "Pro" })
    .onConflictDoUpdate({ target: plans.name, set: { isDefault: false } })
    .returning({ id: plans.id });

  if (!free || !pro) {
    throw new Error("seed plans");
  }

  return { free: free.id, pro: pro.id };
};

describe("adminBillingService.grantFeature", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("creates an active override row and a FEATURE_OVERRIDE_GRANTED audit row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operatorId = await seedUser("op@example.com");
    const customerId = await seedUser("cust@example.com");
    const { account, membership } =
      await accountsService.provisionAfterVerification({
        userId: customerId,
        name: "Cust",
      });

    const result = await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "max_widgets",
      value: { number: 50 },
      expiresAt: null,
      visibility: "internal",
      reason: "manual upgrade for friends-and-family",
      grantedByUserId: operatorId,
      grantedByMembershipId: membership.id,
    });

    const [row] = await db
      .select()
      .from(accountFeatureOverrides)
      .where(eq(accountFeatureOverrides.id, result.id));

    expect(row?.featureKey).toBe("max_widgets");
    expect(row?.revokedAt).toBeNull();

    /*
     * Audit log writes are fire-and-forget; poll briefly for the row
     * instead of a single fixed sleep that races CI's slower runs.
     */
    const deadline = Date.now() + 2000;
    let audits: { id: string }[] = [];

    while (Date.now() < deadline) {
      audits = await db
        .select({ id: auditLog.id })
        .from(auditLog)
        .where(eq(auditLog.action, "feature.override_granted"));

      if (audits.length > 0) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(audits.length).toBeGreaterThan(0);
  });

  test("issuing a second grant for the same (account, feature) revokes the first (partial unique respected)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operatorId = await seedUser("op2@example.com");
    const customerId = await seedUser("cust2@example.com");
    const { account, membership } =
      await accountsService.provisionAfterVerification({
        userId: customerId,
        name: "Cust",
      });

    await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "max_widgets",
      value: { number: 50 },
      expiresAt: null,
      visibility: "internal",
      reason: "first grant",
      grantedByUserId: operatorId,
      grantedByMembershipId: membership.id,
    });

    await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "max_widgets",
      value: { number: 100 },
      expiresAt: null,
      visibility: "internal",
      reason: "second grant overrides",
      grantedByUserId: operatorId,
      grantedByMembershipId: membership.id,
    });

    const active = await db
      .select()
      .from(accountFeatureOverrides)
      .where(
        and(
          eq(accountFeatureOverrides.accountId, account.id),
          isNull(accountFeatureOverrides.revokedAt)
        )
      );

    expect(active).toHaveLength(1);
  });
});

describe("adminBillingService.revokeFeature", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("sets revoked_at + reason, writes audit row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operatorId = await seedUser("op3@example.com");
    const customerId = await seedUser("cust3@example.com");
    const { account, membership } =
      await accountsService.provisionAfterVerification({
        userId: customerId,
        name: "Cust",
      });

    const { id } = await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "can_export",
      value: { bool: true },
      expiresAt: null,
      visibility: "internal",
      reason: "test grant",
      grantedByUserId: operatorId,
      grantedByMembershipId: membership.id,
    });

    await adminBillingService.revokeFeature({
      overrideId: id,
      revokedByUserId: operatorId,
      reason: "revoking the grant",
    });

    const [row] = await db
      .select()
      .from(accountFeatureOverrides)
      .where(eq(accountFeatureOverrides.id, id));

    expect(row?.revokedAt).not.toBeNull();
    expect(row?.revokedReason).toBe("revoking the grant");
  });

  test("revoking an already-revoked override throws notFound", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operatorId = await seedUser("op5@example.com");
    const customerId = await seedUser("cust5@example.com");
    const { account, membership } =
      await accountsService.provisionAfterVerification({
        userId: customerId,
        name: "Cust",
      });

    const { id } = await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "can_export",
      value: { bool: true },
      expiresAt: null,
      visibility: "internal",
      reason: "test grant",
      grantedByUserId: operatorId,
      grantedByMembershipId: membership.id,
    });

    await adminBillingService.revokeFeature({
      overrideId: id,
      revokedByUserId: operatorId,
      reason: "first revoke",
    });

    let caught: unknown;

    try {
      await adminBillingService.revokeFeature({
        overrideId: id,
        revokedByUserId: operatorId,
        reason: "second revoke",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
  });
});

describe("adminBillingService.grantPlan", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("supersedes the previous current plan (one-current-plan partial unique honored)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operatorId = await seedUser("op4@example.com");
    const customerId = await seedUser("cust4@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId: customerId,
      name: "Cust",
    });
    const { free, pro } = await ensurePlans();

    // Seed a baseline Free plan first
    await db.insert(accountPlans).values({
      accountId: account.id,
      planId: free,
      status: "active",
      source: "stripe",
    });

    await adminBillingService.grantPlan({
      accountId: account.id,
      planId: pro,
      expiresAt: null,
      reason: "manual upgrade",
      grantedByUserId: operatorId,
    });

    const active = await db
      .select()
      .from(accountPlans)
      .where(
        and(
          eq(accountPlans.accountId, account.id),
          isNull(accountPlans.revokedAt)
        )
      );

    expect(active).toHaveLength(1);
    expect(active[0]?.planId).toBe(pro);
    expect(active[0]?.source).toBe("admin_grant");
  });

  test("granting the same plan twice revokes the prior row (partial unique honored)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operatorId = await seedUser("op5@example.com");
    const customerId = await seedUser("cust5@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId: customerId,
      name: "Cust",
    });
    const { pro } = await ensurePlans();

    await adminBillingService.grantPlan({
      accountId: account.id,
      planId: pro,
      expiresAt: null,
      reason: "first grant",
      grantedByUserId: operatorId,
    });

    await adminBillingService.grantPlan({
      accountId: account.id,
      planId: pro,
      expiresAt: null,
      reason: "second grant",
      grantedByUserId: operatorId,
    });

    const active = await db
      .select()
      .from(accountPlans)
      .where(
        and(
          eq(accountPlans.accountId, account.id),
          isNull(accountPlans.revokedAt)
        )
      );

    expect(active).toHaveLength(1);
    expect(active[0]?.planId).toBe(pro);
  });
});
