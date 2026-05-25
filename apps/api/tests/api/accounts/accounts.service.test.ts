import { beforeEach, describe, expect, test } from "bun:test";

import { accountsService } from "../../../src/api/accounts/accounts.service";
import { now } from "../../../src/lib/time/now";
import {
  accountMemberships,
  accounts,
  cleanDatabase,
  db,
  eq,
  isNull,
  requireDb,
  users,
} from "../../helpers/db";

const seedUser = async (email: string): Promise<string> => {
  const [row] = await db
    .insert(users)
    .values({ email })
    .returning({ id: users.id });

  if (!row) {
    throw new Error("seed user failed");
  }

  return row.id;
};

describe("accountsService.provisionAfterVerification", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("creates an account, an owner membership, and returns both — atomically", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("solo@example.com");

    const result = await accountsService.provisionAfterVerification({
      userId,
      name: "Solo Tester",
    });

    expect(result.account.name).toBe("Solo Tester");
    expect(result.membership.role).toBe("owner");
    expect(result.membership.accountId).toBe(result.account.id);
    expect(result.membership.userId).toBe(userId);

    const accountRows = await db.select().from(accounts);

    expect(accountRows).toHaveLength(1);

    const membershipRows = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, userId));

    expect(membershipRows).toHaveLength(1);
    expect(membershipRows[0]?.role).toBe("owner");
    expect(membershipRows[0]?.revokedAt).toBeNull();
  });

  test("partial unique index prevents a second active owner membership for the same account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("owner@example.com");

    const { account } = await accountsService.provisionAfterVerification({
      userId,
      name: "Account",
    });

    const otherUserId = await seedUser("other@example.com");

    let threw = false;

    try {
      await db.insert(accountMemberships).values({
        accountId: account.id,
        userId: otherUserId,
        role: "owner",
      });
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("partial unique index prevents two active memberships for the same (user, account)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("dupe@example.com");

    const { account } = await accountsService.provisionAfterVerification({
      userId,
      name: "Account",
    });

    let threw = false;

    try {
      await db.insert(accountMemberships).values({
        accountId: account.id,
        userId,
        role: "admin",
      });
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("idempotent: a second call for the same user returns the existing account + membership, no duplicate inserts", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("idem@example.com");

    const first = await accountsService.provisionAfterVerification({
      userId,
      name: "Idem Account",
    });
    const second = await accountsService.provisionAfterVerification({
      userId,
      name: "Different Name (should be ignored)",
    });

    expect(second.account.id).toBe(first.account.id);
    expect(second.account.name).toBe("Idem Account");
    expect(second.membership.id).toBe(first.membership.id);

    const accountRows = await db.select().from(accounts);

    expect(accountRows).toHaveLength(1);

    const membershipRows = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, userId));

    expect(membershipRows).toHaveLength(1);
  });

  test("derives account name from user firstName/lastName when no override is supplied", async () => {
    if (!(await requireDb())) {
      return;
    }

    const [row] = await db
      .insert(users)
      .values({
        email: "named@example.com",
        firstName: "Alex",
        lastName: "Park",
      })
      .returning({ id: users.id });

    if (!row) {
      throw new Error("seed user failed");
    }

    const result = await accountsService.provisionAfterVerification({
      userId: row.id,
    });

    expect(result.account.name).toBe("Alex Park");
  });

  test("falls back to email when user has no firstName/lastName", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("anon@example.com");

    const result = await accountsService.provisionAfterVerification({
      userId,
    });

    expect(result.account.name).toBe("anon@example.com");
  });

  test("revoked memberships do NOT conflict with the active-membership index", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("rejoin@example.com");

    const { account, membership } =
      await accountsService.provisionAfterVerification({
        userId,
        name: "Account",
      });

    await db
      .update(accountMemberships)
      .set({ revokedAt: now(), revokedReason: "left" })
      .where(eq(accountMemberships.id, membership.id));

    const [reinsert] = await db
      .insert(accountMemberships)
      .values({ accountId: account.id, userId, role: "owner" })
      .returning({ id: accountMemberships.id });

    expect(reinsert).toBeDefined();

    const activeRows = await db
      .select()
      .from(accountMemberships)
      .where(isNull(accountMemberships.revokedAt));

    expect(activeRows).toHaveLength(1);
  });
});

describe("accountsService.getMembershipsForUser", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns every active membership the user holds, in joined-at order", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("multi@example.com");

    const first = await accountsService.provisionAfterVerification({
      userId,
      name: "Personal",
    });

    const otherOwnerId = await seedUser("co@example.com");
    const second = await accountsService.provisionAfterVerification({
      userId: otherOwnerId,
      name: "Co",
    });

    await db.insert(accountMemberships).values({
      accountId: second.account.id,
      userId,
      role: "viewer",
    });

    const memberships = await accountsService.getMembershipsForUser(userId);

    expect(memberships).toHaveLength(2);
    expect(
      memberships.map((membership) => membership.accountId).sort()
    ).toEqual([first.account.id, second.account.id].sort());
  });

  test("omits revoked memberships", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("revoked@example.com");

    const { membership } = await accountsService.provisionAfterVerification({
      userId,
      name: "Personal",
    });

    await db
      .update(accountMemberships)
      .set({
        revokedAt: now(),
        revokedReason: "removed_by_admin",
      })
      .where(eq(accountMemberships.id, membership.id));

    const memberships = await accountsService.getMembershipsForUser(userId);

    expect(memberships).toHaveLength(0);
  });

  test("omits memberships whose account has been soft-deleted", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("deleted-account-member@example.com");

    const { account } = await accountsService.provisionAfterVerification({
      userId,
      name: "Deleted Account",
    });

    await accountsService.softDelete(account.id, userId);

    const memberships = await accountsService.getMembershipsForUser(userId);

    expect(memberships).toHaveLength(0);
  });
});

describe("accountsService — owner lifecycle", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("transferOwnership atomically swaps owner ↔ admin; partial unique never violated", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceId = await seedUser("a@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId: aliceId,
      name: "Alice's Account",
    });

    const bobId = await seedUser("b@example.com");

    await db.insert(accountMemberships).values({
      accountId: account.id,
      userId: bobId,
      role: "admin",
    });

    await accountsService.transferOwnership(
      account.id,
      aliceId,
      bobId,
      aliceId
    );

    const rows = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.accountId, account.id));

    const alice = rows.find((row) => row.userId === aliceId);
    const bob = rows.find((row) => row.userId === bobId);

    expect(alice?.role).toBe("admin");
    expect(bob?.role).toBe("owner");
  });

  test("transferOwnership throws when target membership does not exist", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceId = await seedUser("a2@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId: aliceId,
      name: "Acc",
    });

    let threw = false;

    try {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await accountsService.transferOwnership(
        account.id,
        aliceId,
        fakeId,
        aliceId
      );
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("softDelete sets deletedAt; the deletedAt-IS-NULL filter excludes it", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceId = await seedUser("a3@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId: aliceId,
      name: "Acc",
    });

    await accountsService.softDelete(account.id, aliceId);

    const stillVisible = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, account.id));

    expect(stillVisible).toHaveLength(1);
    expect(stillVisible[0]?.deletedAt).not.toBeNull();

    const activeQuery = await db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt));

    expect(activeQuery.find((row) => row.id === account.id)).toBeUndefined();
  });

  test("switchAccount returns the membership for a real member; throws when the user is not a member", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceId = await seedUser("switch-alice@example.com");
    const bobId = await seedUser("switch-bob@example.com");
    const { account: aliceAcc } =
      await accountsService.provisionAfterVerification({
        userId: aliceId,
        name: "Alice",
      });
    const { account: bobAcc } =
      await accountsService.provisionAfterVerification({
        userId: bobId,
        name: "Bob",
      });

    const ownMembership = await accountsService.switchAccount(
      aliceId,
      aliceAcc.id
    );

    expect(ownMembership.accountId).toBe(aliceAcc.id);
    expect(ownMembership.role).toBe("owner");

    let threw = false;

    try {
      await accountsService.switchAccount(aliceId, bobAcc.id);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("switchAccount rejects memberships attached to a soft-deleted account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("switch-deleted@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId,
      name: "Deleted",
    });

    await accountsService.softDelete(account.id, userId);

    let threw = false;

    try {
      await accountsService.switchAccount(userId, account.id);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("softDelete on an already-deleted account 404s (idempotency boundary)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceId = await seedUser("a4@example.com");
    const { account } = await accountsService.provisionAfterVerification({
      userId: aliceId,
      name: "Acc",
    });

    await accountsService.softDelete(account.id, aliceId);

    let threw = false;

    try {
      await accountsService.softDelete(account.id, aliceId);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });
});

describe("provisionAfterVerification — domain claiming OFF (default)", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("does not set claimedDomain even for non-public email domains", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await seedUser("alice@microsoft.com");

    const result = await accountsService.provisionAfterVerification({ userId });

    expect(result.account.claimedDomain).toBeNull();
  });
});

/*
 * Schema-level safety net. The service layer enforces the same rule
 * via `DOMAIN_CLAIMED`, but the partial unique index is what keeps a
 * buggy or off-flow code path from creating two live accounts that
 * claim the same domain. These tests skip the service entirely and
 * hit the DB to prove the index does its job.
 */
describe("accounts.claimed_domain — partial unique index", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("two active accounts cannot claim the same domain simultaneously", async () => {
    if (!(await requireDb())) {
      return;
    }

    const [first] = await db
      .insert(accounts)
      .values({ name: "Acme", claimedDomain: "acme.example" })
      .returning({ id: accounts.id });

    expect(first).toBeDefined();

    let threw = false;

    try {
      await db
        .insert(accounts)
        .values({ name: "Acme 2", claimedDomain: "acme.example" });
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("a soft-deleted claim releases the domain at the index level", async () => {
    if (!(await requireDb())) {
      return;
    }

    const [first] = await db
      .insert(accounts)
      .values({ name: "Acme", claimedDomain: "acme.example" })
      .returning({ id: accounts.id });

    if (!first) {
      throw new Error("seed");
    }

    await db
      .update(accounts)
      .set({ deletedAt: now() })
      .where(eq(accounts.id, first.id));

    const [second] = await db
      .insert(accounts)
      .values({ name: "Acme 2", claimedDomain: "acme.example" })
      .returning({ id: accounts.id });

    expect(second?.id).toBeDefined();
    expect(second?.id).not.toBe(first.id);
  });

  test("NULL claimed_domain is unconstrained — many accounts may have no claim at all", async () => {
    if (!(await requireDb())) {
      return;
    }

    const [firstAccount] = await db
      .insert(accounts)
      .values({ name: "Personal A" })
      .returning({ id: accounts.id });

    const [secondAccount] = await db
      .insert(accounts)
      .values({ name: "Personal B" })
      .returning({ id: accounts.id });

    expect(firstAccount?.id).toBeDefined();
    expect(secondAccount?.id).toBeDefined();
    expect(firstAccount?.id).not.toBe(secondAccount?.id);
  });
});
