import { beforeEach, describe, expect, test } from "bun:test";

import { accountsService } from "../../../src/api/accounts/accounts.service";
import { invitationsService } from "../../../src/api/accounts/invitations.service";
import { adminBillingService } from "../../../src/api/admin/admin-billing.service";
import { now } from "../../../src/lib/time/now";
import {
  cleanExpiredInvitationsJob,
  cleanStalePendingUsersJob,
  expireAdminPlansJob,
  expireFeatureOverridesJob,
  hardDeleteSoftDeletedAccountsJob,
} from "../../../src/queues/account-maintenance/account-maintenance.jobs";
import {
  accountFeatureOverrides,
  accountInvitations,
  accounts,
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

const PAST = new Date(Date.now() - 1000).toISOString();
const ANCIENT = new Date(Date.now() - 60 * 86_400_000).toISOString();

describe("expireFeatureOverridesJob", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("revokes overrides whose expires_at has passed; idempotent on second run", async () => {
    if (!(await requireDb())) {
      return;
    }

    const op = await seedUser("op@example.com");
    const cust = await seedUser("c@example.com");
    const { account, membership } =
      await accountsService.provisionAfterVerification({
        userId: cust,
        name: "C",
      });

    const { id } = await adminBillingService.grantFeature({
      accountId: account.id,
      featureKey: "max_widgets",
      value: { number: 99 },
      expiresAt: PAST,
      visibility: "internal",
      reason: "trial",
      grantedByUserId: op,
      grantedByMembershipId: membership.id,
    });

    const first = await expireFeatureOverridesJob();

    expect(first.swept).toBeGreaterThanOrEqual(1);

    const [row] = await db
      .select()
      .from(accountFeatureOverrides)
      .where(eq(accountFeatureOverrides.id, id));

    expect(row?.revokedAt).not.toBeNull();
    expect(row?.revokedReason).toBe("expired");

    const second = await expireFeatureOverridesJob();

    expect(second.swept).toBe(0);
  });
});

describe("expireAdminPlansJob", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("revokes admin-granted plans past their expires_at", async () => {
    if (!(await requireDb())) {
      return;
    }

    const op = await seedUser("op2@example.com");
    const cust = await seedUser("c2@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId: cust,
      name: "C",
    });

    const [pro] = await db
      .insert(plans)
      .values({ name: "Pro" })
      .onConflictDoUpdate({ target: plans.name, set: { isDefault: false } })
      .returning({ id: plans.id });

    if (!pro) {
      throw new Error("seed plan");
    }

    await adminBillingService.grantPlan({
      accountId: account.id,
      planId: pro.id,
      expiresAt: PAST,
      reason: "trial",
      grantedByUserId: op,
    });

    const result = await expireAdminPlansJob();

    expect(result.swept).toBeGreaterThanOrEqual(1);
  });
});

describe("hardDeleteSoftDeletedAccountsJob", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("deletes accounts whose deleted_at is older than the grace window", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("expired@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId,
      name: "Old",
    });

    await db
      .update(accounts)
      .set({ deletedAt: ANCIENT })
      .where(eq(accounts.id, account.id));

    const result = await hardDeleteSoftDeletedAccountsJob();

    expect(result.swept).toBeGreaterThanOrEqual(1);

    const remaining = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, account.id));

    expect(remaining).toHaveLength(0);
  });

  test("leaves accounts whose deleted_at is within the grace window alone", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("recent@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId,
      name: "Recent",
    });

    await db
      .update(accounts)
      .set({ deletedAt: now() })
      .where(eq(accounts.id, account.id));

    const result = await hardDeleteSoftDeletedAccountsJob();

    expect(result.swept).toBe(0);

    const remaining = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, account.id));

    expect(remaining).toHaveLength(1);
  });
});

describe("cleanExpiredInvitationsJob", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("revokes unaccepted invitations past their expiry", async () => {
    if (!(await requireDb())) {
      return;
    }

    const ownerId = await seedUser("o@example.com");
    const { account, membership } =
      await accountsService.provisionAfterVerification({
        userId: ownerId,
        name: "O",
      });

    const { invitation } = await invitationsService.create(
      {
        accountId: account.id,
        email: "exp@example.com",
        roleToAssign: "member",
        invitedByMembershipId: membership.id,
      },
      ownerId
    );

    await db
      .update(accountInvitations)
      .set({ expiresAt: PAST })
      .where(eq(accountInvitations.id, invitation.id));

    const result = await cleanExpiredInvitationsJob();

    expect(result.swept).toBeGreaterThanOrEqual(1);

    const [row] = await db
      .select()
      .from(accountInvitations)
      .where(eq(accountInvitations.id, invitation.id));

    expect(row?.revokedAt).not.toBeNull();
  });
});

describe("cleanStalePendingUsersJob", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("hard-deletes pending users older than the grace window; idempotent on second run", async () => {
    if (!(await requireDb())) {
      return;
    }

    const ancientCreatedAt = new Date(
      Date.now() - 60 * 86_400_000
    ).toISOString();
    const recentCreatedAt = now();

    const [stale] = await db
      .insert(users)
      .values({
        email: "stale@example.com",
        createdAt: ancientCreatedAt,
        updatedAt: ancientCreatedAt,
      })
      .returning({ id: users.id });

    const [recentPending] = await db
      .insert(users)
      .values({
        email: "recent@example.com",
        createdAt: recentCreatedAt,
        updatedAt: recentCreatedAt,
      })
      .returning({ id: users.id });

    const [verifiedAncient] = await db
      .insert(users)
      .values({
        email: "verified-ancient@example.com",
        createdAt: ancientCreatedAt,
        updatedAt: ancientCreatedAt,
        emailVerifiedAt: ancientCreatedAt,
      })
      .returning({ id: users.id });

    const first = await cleanStalePendingUsersJob();

    expect(first.swept).toBe(1);

    if (stale) {
      const [row] = await db.select().from(users).where(eq(users.id, stale.id));

      expect(row).toBeUndefined();
    }

    if (recentPending) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, recentPending.id));

      expect(row).toBeDefined();
    }

    if (verifiedAncient) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, verifiedAncient.id));

      expect(row).toBeDefined();
    }

    const second = await cleanStalePendingUsersJob();

    expect(second.swept).toBe(0);

    const remainingPending = await db
      .select()
      .from(users)
      .where(isNull(users.emailVerifiedAt));

    expect(remainingPending).toHaveLength(1);
  });
});
