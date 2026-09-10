/**
 * F12: an account can be left with no active owner.
 *
 * The partial unique index enforces at most one owner, never at least one:
 *
 *   drizzle/0000_modern_chameleon.sql:347
 *   CREATE UNIQUE INDEX "uniq_account_memberships_active_owner"
 *     ON "auth"."account_memberships" (account_id)
 *     WHERE role = 'owner' AND revoked_at IS NULL;
 *
 * `ownership-transfers.service.ts:185-195` reads the target membership with no
 * `FOR UPDATE`, and the promote at `:219-227` filters on the row id alone:
 *
 *   .set({ role: ROLE.owner, updatedAt: now() })
 *   .where(and(eq(accountMemberships.id, target.id),
 *              eq(accountMemberships.accountId, transfer.accountId)));
 *
 * `isNull(revokedAt)` is absent. So a membership revoked after the read is
 * still promoted, the outgoing owner is demoted to admin at `:207-217`, and
 * the account commits with zero active owners. The partial index does not fire
 * because revoked rows are excluded from it. Recovery through the API is
 * impossible: `ownership-transfers.service.ts:35` requires a current owner to
 * initiate a transfer. The `FOR UPDATE` at `:173` locks the transfer row, not
 * the membership rows.
 *
 * Reproducing it deterministically
 * ---------------------------------
 * The SELECT at `:185` does filter `isNull(revokedAt)`, so a revocation that
 * commits BEFORE accept begins is handled correctly: accept simply finds no
 * target. The defect needs the revocation to land between accept's read and
 * its write, which scheduling alone does not arrange reliably.
 *
 * So the schedule is imposed with a row lock on a second connection:
 *
 *   1. hold `SELECT ... FOR UPDATE` on the successor's membership row
 *   2. call accept: its plain SELECT still sees an ACTIVE membership, then
 *      its promote UPDATE blocks on the lock
 *   3. revoke the membership from the lock holder and COMMIT
 *   4. accept's UPDATE unblocks, re-reads the row under READ COMMITTED, and
 *      its predicate (id + accountId, no revokedAt) still matches
 *
 * The sitting owner has already been demoted at `:207`, so the account
 * commits with zero active owners.
 *
 * Not claimed here: the invitation-token TOCTOU. Under serial execution the
 * rotated token is correctly refused (third test). The concurrent window
 * between `invitations.service.ts:232` and `:258` is real on inspection, but
 * it did not reproduce deterministically at the service boundary, so it is
 * documented rather than asserted.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import postgres from "postgres";

import { invitationsService } from "../src/api/accounts/invitations.service";
import { ownershipTransfersService } from "../src/api/accounts/ownership-transfers.service";
import {
  accountMemberships,
  and,
  cleanDatabase,
  db,
  eq,
  isNull,
  postgresClient,
} from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail, specPrecondition } from "./harness";

/* Public domains, so domain claiming stays out of this file entirely. */
const OWNER = "f12-owner@gmail.com";
const SUCCESSOR = "f12-successor@gmail.com";
const INVITEE = "f12-invitee@outlook.com";

const activeOwners = async (accountId: string): Promise<unknown[]> =>
  db
    .select()
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.accountId, accountId),
        eq(accountMemberships.role, "owner"),
        isNull(accountMemberships.revokedAt)
      )
    );

/**
 * Polls until another backend is waiting on a lock, so the schedule is
 * observed rather than assumed.
 *
 * Uses the shared pool rather than the lock holder's connection: the holder
 * is a single-connection client sitting inside an open transaction, so a
 * query issued on it would queue behind that transaction and never answer.
 */
const waitForBlockedWriter = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await postgresClient`
      select 1 from pg_stat_activity
      where wait_event_type = 'Lock'
        and state = 'active'
        and query ilike '%account_memberships%'
      limit 1
    `;

    if (rows.length > 0) {
      return true;
    }

    await Bun.sleep(50);
  }

  return false;
};

interface ITransferFixture {
  readonly accountId: string;
  readonly successorId: string;
  readonly rawToken: string;
}

/** Owner plus an admin successor, with a pending transfer between them. */
const seedPendingTransfer = async (): Promise<ITransferFixture> => {
  const { user: owner, account } = await seedVerifiedUser({ email: OWNER });
  const { user: successor } = await seedVerifiedUser({ email: SUCCESSOR });

  await db.insert(accountMemberships).values({
    accountId: account.id,
    userId: successor.id,
    role: "admin",
  });

  const transfer = await ownershipTransfersService.initiate({
    accountId: account.id,
    fromUserId: owner.id,
    toUserId: successor.id,
    actorUserId: owner.id,
  });

  const ownersAtStart = await activeOwners(account.id);

  specPrecondition(
    ownersAtStart.length === 1,
    "fixture should start with exactly one active owner"
  );

  return {
    accountId: account.id,
    successorId: successor.id,
    rawToken: transfer.rawToken,
  };
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F12 membership lifecycle invariants", () => {
  test("a membership revoked mid-accept is not promoted to owner", async () => {
    const { accountId, successorId, rawToken } = await seedPendingTransfer();

    const [membership] = await db
      .select()
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.accountId, accountId),
          eq(accountMemberships.userId, successorId)
        )
      );

    specPrecondition(
      membership !== undefined,
      "successor membership missing from fixture"
    );

    const databaseUrl = process.env.DATABASE_URL;

    specPrecondition(
      databaseUrl !== undefined && databaseUrl !== "",
      "DATABASE_URL must be set to impose the lock schedule"
    );

    const blocker = postgres(databaseUrl, {
      max: 1,
      onnotice: () => undefined,
    });

    let lockHeld = (): void => undefined;
    let releaseLock = (): void => undefined;
    const lockIsHeld = new Promise<void>((resolve) => {
      lockHeld = resolve;
    });
    const mayRevoke = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Step 1 + 3: hold the row, then revoke and commit when told.
    const blockerTx = blocker
      .begin(async (sql) => {
        await sql`
          select id from auth.account_memberships
          where id = ${membership.id} for update
        `;
        lockHeld();
        await mayRevoke;
        await sql`
          update auth.account_memberships
          set revoked_at = now() where id = ${membership.id}
        `;
      })
      .catch(() => undefined);

    try {
      await lockIsHeld;

      // Step 2: accept reads an active membership, then blocks on the write.
      const accepting = ownershipTransfersService
        .accept(rawToken, successorId, SUCCESSOR)
        .catch(() => undefined);

      const blocked = await waitForBlockedWriter();

      specPrecondition(
        blocked,
        "accept did not block on the membership row; the schedule did not hold"
      );

      // Step 4: let the revocation commit underneath it.
      releaseLock();
      await blockerTx;
      await accepting;
    } finally {
      releaseLock();
      await blockerTx;
      await blocker.end();
    }

    /*
     * Accept must not hand ownership to a membership that was revoked while
     * it was mid-flight, because that demotes the sitting owner and leaves
     * nobody in charge, with no API path back.
     */
    const owners = await activeOwners(accountId);

    expect(owners).toHaveLength(1);
  }, 30_000);

  test("control: an ordinary transfer still moves ownership", async () => {
    const { accountId, successorId, rawToken } = await seedPendingTransfer();

    await ownershipTransfersService.accept(rawToken, successorId, SUCCESSOR);

    expect(await activeOwners(accountId)).toHaveLength(1);
  });

  test("control: a rotated invitation token is refused", async () => {
    const { user: owner, account } = await seedVerifiedUser({ email: OWNER });

    const [ownerMembership] = await db
      .select()
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.accountId, account.id),
          eq(accountMemberships.userId, owner.id)
        )
      );

    specPrecondition(
      ownerMembership !== undefined,
      "owner membership missing from fixture"
    );

    const { user: invitee } = await seedVerifiedUser({ email: INVITEE });

    const invitation = await invitationsService.create(
      {
        accountId: account.id,
        email: INVITEE,
        roleToAssign: "member",
        invitedByMembershipId: ownerMembership.id,
      },
      owner.id
    );

    const staleToken = invitation.rawToken;

    await invitationsService.resend(
      account.id,
      invitation.invitation.id,
      owner.id
    );

    const accepted = await invitationsService
      .accept(staleToken, invitee.id, INVITEE)
      .then(() => "accepted")
      .catch(() => "refused");

    /*
     * Documents the property the route advertises ("Resend (and rotate)").
     * This passes today under serial execution, which is why the concurrent
     * TOCTOU is not claimed as proven above.
     */
    expect(accepted).toBe("refused");
  });
});
