import { beforeEach, describe, expect, test } from "bun:test";

import { accountsService } from "../../../src/api/accounts/accounts.service";
import { joinRequestsService } from "../../../src/api/accounts/join-requests.service";
import {
  accountJoinRequests,
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
const REQUESTER_EMAIL = "requester@acme.test";
const REQUESTER_B_EMAIL = "b@acme.test";
const REQUESTER_C_EMAIL = "c@other.test";
const OTHER_OWNER_EMAIL = "other@other.test";

const seedUserAndAccount = async (
  email: string
): Promise<{ userId: string; accountId: string }> => {
  const [user] = await db.insert(users).values({ email }).returning();

  if (!user) {
    throw new Error("seed user");
  }

  const { account } = await accountsService.provisionAfterVerification({
    userId: user.id,
    name: email,
  });

  return { userId: user.id, accountId: account.id };
};

const seedRequesterUser = async (email: string): Promise<string> => {
  const [user] = await db.insert(users).values({ email }).returning();

  if (!user) {
    throw new Error("seed requester");
  }

  return user.id;
};

const createPendingFor = async (
  accountId: string,
  userId: string,
  email: string
): Promise<{ id: string; isNew: boolean }> =>
  joinRequestsService.createPending({ accountId, userId, email });

const expectRejects = async (promise: Promise<unknown>): Promise<void> => {
  let threw = false;

  try {
    await promise;
  } catch {
    threw = true;
  }

  expect(threw).toBe(true);
};

describe("JoinRequestsService", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  describe("createPending", () => {
    test("creates a pending row and returns isNew=true", async () => {
      if (!(await requireDb())) {
        return;
      }

      const owner = await seedUserAndAccount(OWNER_EMAIL);
      const requester = await seedRequesterUser(REQUESTER_EMAIL);

      const result = await createPendingFor(
        owner.accountId,
        requester,
        REQUESTER_EMAIL
      );

      expect(result.isNew).toBe(true);
      expect(result.id).toBeTruthy();

      const [row] = await db
        .select()
        .from(accountJoinRequests)
        .where(eq(accountJoinRequests.id, result.id))
        .limit(1);

      expect(row?.status).toBe("pending");
      expect(row?.email).toBe(REQUESTER_EMAIL);
    });

    test("is idempotent for the same (accountId, userId) pending pair", async () => {
      if (!(await requireDb())) {
        return;
      }

      const owner = await seedUserAndAccount(OWNER_EMAIL);
      const requester = await seedRequesterUser(REQUESTER_EMAIL);

      const first = await createPendingFor(
        owner.accountId,
        requester,
        REQUESTER_EMAIL
      );

      const second = await createPendingFor(
        owner.accountId,
        requester,
        REQUESTER_EMAIL
      );

      expect(first.id).toBe(second.id);
      expect(first.isNew).toBe(true);
      expect(second.isNew).toBe(false);
    });
  });

  describe("listPending", () => {
    test("returns only pending rows for the requested account, in created order", async () => {
      if (!(await requireDb())) {
        return;
      }

      const owner = await seedUserAndAccount(OWNER_EMAIL);
      const otherOwner = await seedUserAndAccount(OTHER_OWNER_EMAIL);
      const requesterA = await seedRequesterUser(REQUESTER_EMAIL);
      const requesterB = await seedRequesterUser(REQUESTER_B_EMAIL);
      const requesterC = await seedRequesterUser(REQUESTER_C_EMAIL);

      const a = await createPendingFor(
        owner.accountId,
        requesterA,
        REQUESTER_EMAIL
      );

      const b = await createPendingFor(
        owner.accountId,
        requesterB,
        REQUESTER_B_EMAIL
      );

      await createPendingFor(
        otherOwner.accountId,
        requesterC,
        REQUESTER_C_EMAIL
      );

      const pending = await joinRequestsService.listPending(owner.accountId);

      expect(pending.map((r) => r.id)).toEqual([a.id, b.id]);
      expect(pending.every((r) => r.status === "pending")).toBe(true);
    });
  });

  describe("approve", () => {
    test("creates a member-level active membership and flips status", async () => {
      if (!(await requireDb())) {
        return;
      }

      const owner = await seedUserAndAccount(OWNER_EMAIL);
      const requester = await seedRequesterUser(REQUESTER_EMAIL);

      const created = await createPendingFor(
        owner.accountId,
        requester,
        REQUESTER_EMAIL
      );

      const approved = await joinRequestsService.approve(
        owner.accountId,
        created.id,
        owner.userId
      );

      expect(approved.status).toBe("approved");
      expect(approved.decidedAt).not.toBeNull();
      expect(approved.decidedByUserId).toBe(owner.userId);

      const [membership] = await db
        .select()
        .from(accountMemberships)
        .where(
          and(
            eq(accountMemberships.accountId, owner.accountId),
            eq(accountMemberships.userId, requester),
            isNull(accountMemberships.revokedAt)
          )
        )
        .limit(1);

      expect(membership?.role).toBe("member");
    });

    test("404s for an unknown or already-decided request", async () => {
      if (!(await requireDb())) {
        return;
      }

      const owner = await seedUserAndAccount(OWNER_EMAIL);

      await expectRejects(
        joinRequestsService.approve(
          owner.accountId,
          "00000000-0000-0000-0000-000000000000",
          owner.userId
        )
      );
    });

    test("a second approve of the same request fails", async () => {
      if (!(await requireDb())) {
        return;
      }

      const owner = await seedUserAndAccount(OWNER_EMAIL);
      const requester = await seedRequesterUser(REQUESTER_EMAIL);

      const created = await createPendingFor(
        owner.accountId,
        requester,
        REQUESTER_EMAIL
      );

      await joinRequestsService.approve(
        owner.accountId,
        created.id,
        owner.userId
      );

      await expectRejects(
        joinRequestsService.approve(owner.accountId, created.id, owner.userId)
      );
    });
  });

  describe("deny", () => {
    test("flips status to denied without creating a membership", async () => {
      if (!(await requireDb())) {
        return;
      }

      const owner = await seedUserAndAccount(OWNER_EMAIL);
      const requester = await seedRequesterUser(REQUESTER_EMAIL);

      const created = await createPendingFor(
        owner.accountId,
        requester,
        REQUESTER_EMAIL
      );

      const denied = await joinRequestsService.deny(
        owner.accountId,
        created.id,
        owner.userId
      );

      expect(denied.status).toBe("denied");
      expect(denied.decidedAt).not.toBeNull();

      const [membership] = await db
        .select()
        .from(accountMemberships)
        .where(
          and(
            eq(accountMemberships.accountId, owner.accountId),
            eq(accountMemberships.userId, requester)
          )
        )
        .limit(1);

      expect(membership).toBeUndefined();
    });
  });
});
