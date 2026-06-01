import { beforeEach, describe, expect, test } from "bun:test";

import { accountsService } from "../../../src/api/accounts/accounts.service";
import { ownershipTransfersService } from "../../../src/api/accounts/ownership-transfers.service";
import {
  accountMemberships,
  and,
  cleanDatabase,
  db,
  eq,
  isNull,
  requireDb,
  users,
} from "../../helpers/db";

const OWNER_EMAIL = "owner@acme.test";
const TARGET_EMAIL = "target@acme.test";

const expectRejects = async (promise: Promise<unknown>): Promise<void> => {
  let threw = false;

  try {
    await promise;
  } catch {
    threw = true;
  }

  expect(threw).toBe(true);
};

const seedOwnerAndTarget = async (): Promise<{
  ownerUserId: string;
  targetUserId: string;
  accountId: string;
}> => {
  const [ownerUser] = await db
    .insert(users)
    .values({ email: OWNER_EMAIL })
    .returning();

  if (!ownerUser) {
    throw new Error("seed owner");
  }

  const { account } = await accountsService.provisionAfterVerification({
    userId: ownerUser.id,
    name: "acme",
  });

  const [targetUser] = await db
    .insert(users)
    .values({ email: TARGET_EMAIL })
    .returning();

  if (!targetUser) {
    throw new Error("seed target");
  }

  await db.insert(accountMemberships).values({
    accountId: account.id,
    userId: targetUser.id,
    role: "admin",
  });

  return {
    ownerUserId: ownerUser.id,
    targetUserId: targetUser.id,
    accountId: account.id,
  };
};

describe("OwnershipTransfersService", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  describe("initiate", () => {
    test("creates a pending transfer and returns a raw token", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      const { transfer, rawToken } = await ownershipTransfersService.initiate({
        accountId: seed.accountId,
        fromUserId: seed.ownerUserId,
        toUserId: seed.targetUserId,
        actorUserId: seed.ownerUserId,
      });

      expect(transfer.acceptedAt).toBeNull();
      expect(transfer.declinedAt).toBeNull();
      expect(transfer.cancelledAt).toBeNull();
      expect(rawToken.length).toBeGreaterThan(0);
    });

    test("rejects self-transfer", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      await expectRejects(
        ownershipTransfersService.initiate({
          accountId: seed.accountId,
          fromUserId: seed.ownerUserId,
          toUserId: seed.ownerUserId,
          actorUserId: seed.ownerUserId,
        })
      );
    });

    test("blocks a second concurrent pending offer for the same account", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      await ownershipTransfersService.initiate({
        accountId: seed.accountId,
        fromUserId: seed.ownerUserId,
        toUserId: seed.targetUserId,
        actorUserId: seed.ownerUserId,
      });

      await expectRejects(
        ownershipTransfersService.initiate({
          accountId: seed.accountId,
          fromUserId: seed.ownerUserId,
          toUserId: seed.targetUserId,
          actorUserId: seed.ownerUserId,
        })
      );
    });
  });

  describe("accept", () => {
    test("swaps roles atomically when the target accepts", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      const { rawToken } = await ownershipTransfersService.initiate({
        accountId: seed.accountId,
        fromUserId: seed.ownerUserId,
        toUserId: seed.targetUserId,
        actorUserId: seed.ownerUserId,
      });

      const accepted = await ownershipTransfersService.accept(
        rawToken,
        seed.targetUserId,
        TARGET_EMAIL
      );

      expect(accepted.acceptedAt).not.toBeNull();

      const memberships = await db
        .select({
          userId: accountMemberships.userId,
          role: accountMemberships.role,
        })
        .from(accountMemberships)
        .where(
          and(
            eq(accountMemberships.accountId, seed.accountId),
            isNull(accountMemberships.revokedAt)
          )
        );

      const byUser = new Map(memberships.map((m) => [m.userId, m.role]));

      expect(byUser.get(seed.ownerUserId)).toBe("admin");
      expect(byUser.get(seed.targetUserId)).toBe("owner");
    });

    test("refuses acceptance by a user who is not the named recipient", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      const { rawToken } = await ownershipTransfersService.initiate({
        accountId: seed.accountId,
        fromUserId: seed.ownerUserId,
        toUserId: seed.targetUserId,
        actorUserId: seed.ownerUserId,
      });

      await expectRejects(
        ownershipTransfersService.accept(
          rawToken,
          seed.ownerUserId,
          OWNER_EMAIL
        )
      );
    });

    test("a second accept of the same token fails", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      const { rawToken } = await ownershipTransfersService.initiate({
        accountId: seed.accountId,
        fromUserId: seed.ownerUserId,
        toUserId: seed.targetUserId,
        actorUserId: seed.ownerUserId,
      });

      await ownershipTransfersService.accept(
        rawToken,
        seed.targetUserId,
        TARGET_EMAIL
      );

      await expectRejects(
        ownershipTransfersService.accept(
          rawToken,
          seed.targetUserId,
          TARGET_EMAIL
        )
      );
    });
  });

  describe("decline", () => {
    test("marks the transfer declined without swapping roles", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      const { rawToken } = await ownershipTransfersService.initiate({
        accountId: seed.accountId,
        fromUserId: seed.ownerUserId,
        toUserId: seed.targetUserId,
        actorUserId: seed.ownerUserId,
      });

      const declined = await ownershipTransfersService.decline(
        rawToken,
        seed.targetUserId
      );

      expect(declined.declinedAt).not.toBeNull();

      const memberships = await db
        .select({
          userId: accountMemberships.userId,
          role: accountMemberships.role,
        })
        .from(accountMemberships)
        .where(eq(accountMemberships.accountId, seed.accountId));

      const byUser = new Map(memberships.map((m) => [m.userId, m.role]));

      expect(byUser.get(seed.ownerUserId)).toBe("owner");
      expect(byUser.get(seed.targetUserId)).toBe("admin");
    });
  });

  describe("cancel + getPending", () => {
    test("getPending returns the live offer; cancel clears it", async () => {
      if (!(await requireDb())) {
        return;
      }

      const seed = await seedOwnerAndTarget();

      const { transfer } = await ownershipTransfersService.initiate({
        accountId: seed.accountId,
        fromUserId: seed.ownerUserId,
        toUserId: seed.targetUserId,
        actorUserId: seed.ownerUserId,
      });

      const pendingBefore = await ownershipTransfersService.getPending(
        seed.accountId
      );

      expect(pendingBefore?.id).toBe(transfer.id);

      await ownershipTransfersService.cancel(
        seed.accountId,
        transfer.id,
        seed.ownerUserId
      );

      const pendingAfter = await ownershipTransfersService.getPending(
        seed.accountId
      );

      expect(pendingAfter).toBeNull();
    });
  });
});
