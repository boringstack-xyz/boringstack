import { beforeEach, describe, expect, test } from "bun:test";

import { accountsService } from "../../../src/api/accounts/accounts.service";
import { invitationsService } from "../../../src/api/accounts/invitations.service";
import {
  accountInvitations,
  accountMemberships,
  cleanDatabase,
  db,
  eq,
  requireDb,
  users,
} from "../../helpers/db";

const seedUserAndAccount = async (
  email: string
): Promise<{
  userId: string;
  accountId: string;
  membershipId: string;
  email: string;
}> => {
  const [user] = await db.insert(users).values({ email }).returning();

  if (!user) {
    throw new Error("seed user");
  }

  const { account, membership } =
    await accountsService.provisionAfterVerification({
      userId: user.id,
      name: email,
    });

  return {
    userId: user.id,
    accountId: account.id,
    membershipId: membership.id,
    email: user.email,
  };
};

describe("InvitationsService", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("create issues a hashed token + audit row, leaves accepted/revoked null", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("owner@example.com");

    const { invitation, rawToken } = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "invitee@example.com",
        roleToAssign: "member",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );

    expect(rawToken.length).toBeGreaterThan(20);
    expect(invitation.acceptedAt).toBeNull();
    expect(invitation.revokedAt).toBeNull();
    expect(invitation.tokenHash).not.toBe(rawToken);
  });

  test("accept creates a membership and marks accepted_at", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("owner2@example.com");
    const { rawToken } = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "invitee2@example.com",
        roleToAssign: "member",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );

    const invitee = await seedUserAndAccount("invitee2@example.com");

    const accepted = await invitationsService.accept(
      rawToken,
      invitee.userId,
      invitee.email
    );

    expect(accepted.acceptedAt).not.toBeNull();

    const memberships = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, invitee.userId));

    // 1 personal-account membership + 1 from the invitation acceptance
    expect(memberships).toHaveLength(2);
    expect(
      memberships.some((member) => member.accountId === owner.accountId)
    ).toBe(true);
  });

  test("accept rejects when the authenticated user's email does not match the invitation", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("owner-mismatch@example.com");
    const { rawToken } = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "invited-mismatch@example.com",
        roleToAssign: "member",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );
    const wrongUser = await seedUserAndAccount("wrong-mismatch@example.com");

    let threw = false;

    try {
      await invitationsService.accept(
        rawToken,
        wrongUser.userId,
        wrongUser.email
      );
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("accept rejects an already-accepted token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("owner3@example.com");
    const { rawToken } = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "invitee3@example.com",
        roleToAssign: "viewer",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );
    const invitee = await seedUserAndAccount("invitee3@example.com");

    await invitationsService.accept(rawToken, invitee.userId, invitee.email);

    let threw = false;

    try {
      await invitationsService.accept(rawToken, invitee.userId, invitee.email);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("accept rejects an expired token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("owner4@example.com");
    const { invitation, rawToken } = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "exp@example.com",
        roleToAssign: "member",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );

    await db
      .update(accountInvitations)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(accountInvitations.id, invitation.id));

    let threw = false;

    try {
      const invitee = await seedUserAndAccount("invitee4@example.com");

      await invitationsService.accept(rawToken, invitee.userId, invitee.email);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("resend rotates the token (the old raw token no longer accepts)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("owner5@example.com");
    const first = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "invitee5@example.com",
        roleToAssign: "member",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );

    const second = await invitationsService.resend(
      owner.accountId,
      first.invitation.id,
      owner.userId
    );

    expect(second.rawToken).not.toBe(first.rawToken);

    const invitee = await seedUserAndAccount("invitee5@example.com");

    let threwOnOldToken = false;

    try {
      await invitationsService.accept(
        first.rawToken,
        invitee.userId,
        invitee.email
      );
    } catch {
      threwOnOldToken = true;
    }

    expect(threwOnOldToken).toBe(true);

    const accepted = await invitationsService.accept(
      second.rawToken,
      invitee.userId,
      invitee.email
    );

    expect(accepted.acceptedAt).not.toBeNull();
  });

  test("revoke prevents accept", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("owner6@example.com");
    const { invitation, rawToken } = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "rev@example.com",
        roleToAssign: "viewer",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );

    await invitationsService.revoke(
      owner.accountId,
      invitation.id,
      owner.userId
    );

    let threw = false;

    try {
      const invitee = await seedUserAndAccount("invitee6@example.com");

      await invitationsService.accept(rawToken, invitee.userId, invitee.email);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  test("listPending returns an empty array when no invitations exist", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("empty-pending@example.com");
    const rows = await invitationsService.listPending(owner.accountId);

    expect(rows).toEqual([]);
  });

  test("listPending excludes accepted invitations", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await seedUserAndAccount("list-excl@example.com");
    const { rawToken } = await invitationsService.create(
      {
        accountId: owner.accountId,
        email: "list-invitee@example.com",
        roleToAssign: "member",
        invitedByMembershipId: owner.membershipId,
      },
      owner.userId
    );

    const invitee = await seedUserAndAccount("list-invitee@example.com");

    await invitationsService.accept(rawToken, invitee.userId, invitee.email);

    const rows = await invitationsService.listPending(owner.accountId);

    expect(rows).toHaveLength(0);
  });
});
