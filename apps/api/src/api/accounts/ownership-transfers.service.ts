import { and, eq, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../clients/postgres";
import {
  accountMemberships,
  accountOwnershipTransfers,
  accounts,
  users,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ROLE } from "../../lib/acl";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { notifications } from "../../lib/notifications";
import { now } from "../../lib/time/now";
import { generateOpaqueToken, hashOpaqueToken } from "../../lib/tokens";
import { accountOwnershipTransferredEvent } from "../notifications/events";

import {
  computeOwnershipTransferExpiresAt,
  dispatchOwnershipTransferEmail,
  isLiveOwnershipTransfer,
  toOwnershipTransfer,
} from "./ownership-transfers.utils";
import type {
  IInitiateOwnershipTransferInput,
  IInitiateOwnershipTransferResult,
  IOwnershipTransfer,
} from "./ownership-transfers.types";

export class OwnershipTransfersService {
  /**
   * Files a pending transfer offer. The current owner is *not* demoted
   * here — the swap happens only on `accept`. The partial unique index
   * on (account_id) WHERE pending guarantees at most one outstanding
   * offer per account; a second initiate while one is live will fail
   * the unique constraint and surface as a 409.
   */
  async initiate(
    input: IInitiateOwnershipTransferInput
  ): Promise<IInitiateOwnershipTransferResult> {
    if (input.fromUserId === input.toUserId) {
      throw ApiErrors.validation(
        "Cannot transfer ownership to yourself",
        "toUserId"
      );
    }

    /*
     * The target must be an active member of this account. Accept later
     * rejects non-members cleanly, but without this guard an owner can
     * file transfer offers pointing at non-members / deleted / unknown
     * users, leaving orphaned pending rows. Validate at the source.
     */
    const [targetMembership] = await db
      .select({ id: accountMemberships.id })
      .from(accountMemberships)
      .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
      .where(
        and(
          eq(accountMemberships.userId, input.toUserId),
          eq(accountMemberships.accountId, input.accountId),
          isNull(accountMemberships.revokedAt),
          isNull(accounts.deletedAt)
        )
      )
      .limit(1);

    if (targetMembership === undefined) {
      throw ApiErrors.validation(
        "Target user is not an active member of this account",
        "toUserId"
      );
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = computeOwnershipTransferExpiresAt();

    let inserted: typeof accountOwnershipTransfers.$inferSelect | undefined;

    try {
      const rows = await db
        .insert(accountOwnershipTransfers)
        .values({
          accountId: input.accountId,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          tokenHash,
          expiresAt,
        })
        .returning();

      inserted = rows[0];
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      if (message.includes("uniq_account_ownership_transfers_pending")) {
        throw ApiErrors.conflict(
          "An ownership transfer is already pending for this account"
        );
      }

      throw error;
    }

    if (!inserted) {
      throw ApiErrors.database("Failed to create ownership transfer");
    }

    void auditLogService.record({
      userId: input.actorUserId,
      action: AUDIT_ACTIONS.ACCOUNT_OWNERSHIP_TRANSFER_INITIATED,
      resource: `account:${input.accountId}`,
      metadata: {
        transferId: inserted.id,
        toUserId: input.toUserId,
      },
    });

    const insertedId = inserted.id;

    this.fireTargetNotification(insertedId, rawToken).catch(
      (error: unknown) => {
        logger.warn("Ownership transfer email failed", {
          event: "accounts.ownership_transfer.email_failed",
          transferId: insertedId,
          error: getErrorMessage(error),
        });
      }
    );

    return { transfer: toOwnershipTransfer(inserted), rawToken };
  }

  /**
   * Accepts an outstanding offer. The token-hash lookup, expiry check,
   * email match, owner swap, and offer-status flip all run inside a
   * single transaction so a crash mid-flow can never leave a half-swap
   * (two owners or zero) or an accepted offer without a promoted seat.
   */
  async accept(
    token: string,
    acceptingUserId: string,
    acceptingUserEmail: string
  ): Promise<IOwnershipTransfer> {
    const tokenHash = hashOpaqueToken(token);

    return db.transaction(async (tx) => {
      /*
       * `FOR UPDATE` row-locks the transfer for the duration of the
       * transaction. Two concurrent accepts on the same token serialise
       * here: the second waits for the first commit, then re-reads with
       * `acceptedAt` populated and fails the `isNull(acceptedAt)`
       * filter, returning a clean 404 instead of double-firing the role
       * swap and audit writes.
       */
      const [transfer] = await tx
        .select()
        .from(accountOwnershipTransfers)
        .where(
          and(
            eq(accountOwnershipTransfers.tokenHash, tokenHash),
            isNull(accountOwnershipTransfers.acceptedAt),
            isNull(accountOwnershipTransfers.declinedAt),
            isNull(accountOwnershipTransfers.cancelledAt),
            gt(accountOwnershipTransfers.expiresAt, now())
          )
        )
        .limit(1)
        .for("update");

      if (!transfer) {
        throw ApiErrors.notFound("Ownership transfer");
      }

      if (transfer.toUserId !== acceptingUserId) {
        throw ApiErrors.forbidden(
          "Only the named recipient can accept this transfer"
        );
      }

      const [target] = await tx
        .select()
        .from(accountMemberships)
        .where(
          and(
            eq(accountMemberships.accountId, transfer.accountId),
            eq(accountMemberships.userId, transfer.toUserId),
            isNull(accountMemberships.revokedAt)
          )
        )
        .limit(1);

      if (!target) {
        throw ApiErrors.validation(
          "Target is no longer a member of this account"
        );
      }

      /*
       * Demote the outgoing owner first so the partial unique index
       * never sees two `owner` rows simultaneously.
       */
      await tx
        .update(accountMemberships)
        .set({ role: ROLE.admin, updatedAt: now() })
        .where(
          and(
            eq(accountMemberships.accountId, transfer.accountId),
            eq(accountMemberships.userId, transfer.fromUserId),
            eq(accountMemberships.role, ROLE.owner),
            isNull(accountMemberships.revokedAt)
          )
        );

      await tx
        .update(accountMemberships)
        .set({ role: ROLE.owner, updatedAt: now() })
        .where(
          and(
            eq(accountMemberships.id, target.id),
            eq(accountMemberships.accountId, transfer.accountId)
          )
        );

      const [accepted] = await tx
        .update(accountOwnershipTransfers)
        .set({ acceptedAt: now(), updatedAt: now() })
        .where(eq(accountOwnershipTransfers.id, transfer.id))
        .returning();

      if (!accepted) {
        throw ApiErrors.database("Failed to mark transfer accepted");
      }

      void auditLogService.record({
        userId: acceptingUserId,
        action: AUDIT_ACTIONS.ACCOUNT_OWNERSHIP_TRANSFER_ACCEPTED,
        resource: `account:${transfer.accountId}`,
        metadata: {
          transferId: transfer.id,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
        },
      });

      /*
       * Also record the canonical "owner transferred" event so reports
       * built around that name continue to see a single line per
       * account hand-off.
       */
      void auditLogService.record({
        userId: acceptingUserId,
        action: AUDIT_ACTIONS.ACCOUNT_OWNER_TRANSFERRED,
        resource: `account:${transfer.accountId}`,
        metadata: {
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          via: "two_step",
        },
      });

      const [accountRow] = await tx
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, transfer.accountId))
        .limit(1);

      void notifications.send(accountOwnershipTransferredEvent, {
        recipientUserId: transfer.fromUserId,
        payload: {
          accountId: transfer.accountId,
          accountName: accountRow?.name ?? "",
          newOwnerEmail: acceptingUserEmail,
          settingsUrl: `${env.FRONTEND_URL}/account/settings`,
        },
      });

      return toOwnershipTransfer(accepted);
    });
  }

  async decline(
    token: string,
    decliningUserId: string
  ): Promise<IOwnershipTransfer> {
    const tokenHash = hashOpaqueToken(token);

    return db.transaction(async (tx) => {
      /*
       * Mirrors `accept()`'s `FOR UPDATE`. Without the row lock, an
       * accept running in parallel commits its UPDATE between this
       * SELECT and a naive UPDATE-by-id, and both `acceptedAt` and
       * `declinedAt` end up set. The row lock + a WHERE that repeats
       * the `acceptedAt IS NULL` predicates on the UPDATE forces the
       * loser to fall through to a clean 404.
       */
      const [transfer] = await tx
        .select()
        .from(accountOwnershipTransfers)
        .where(
          and(
            eq(accountOwnershipTransfers.tokenHash, tokenHash),
            isNull(accountOwnershipTransfers.acceptedAt),
            isNull(accountOwnershipTransfers.declinedAt),
            isNull(accountOwnershipTransfers.cancelledAt)
          )
        )
        .limit(1)
        .for("update");

      if (!transfer) {
        throw ApiErrors.notFound("Ownership transfer");
      }

      if (transfer.toUserId !== decliningUserId) {
        throw ApiErrors.forbidden(
          "Only the named recipient can decline this transfer"
        );
      }

      const [declined] = await tx
        .update(accountOwnershipTransfers)
        .set({ declinedAt: now(), updatedAt: now() })
        .where(
          and(
            eq(accountOwnershipTransfers.id, transfer.id),
            isNull(accountOwnershipTransfers.acceptedAt),
            isNull(accountOwnershipTransfers.declinedAt),
            isNull(accountOwnershipTransfers.cancelledAt)
          )
        )
        .returning();

      if (!declined) {
        throw ApiErrors.notFound("Ownership transfer");
      }

      void auditLogService.record({
        userId: decliningUserId,
        action: AUDIT_ACTIONS.ACCOUNT_OWNERSHIP_TRANSFER_DECLINED,
        resource: `account:${transfer.accountId}`,
        metadata: { transferId: transfer.id },
      });

      return toOwnershipTransfer(declined);
    });
  }

  async cancel(
    accountId: string,
    transferId: string,
    actorUserId: string
  ): Promise<void> {
    const [cancelled] = await db
      .update(accountOwnershipTransfers)
      .set({ cancelledAt: now(), updatedAt: now() })
      .where(
        and(
          eq(accountOwnershipTransfers.id, transferId),
          eq(accountOwnershipTransfers.accountId, accountId),
          isNull(accountOwnershipTransfers.acceptedAt),
          isNull(accountOwnershipTransfers.declinedAt),
          isNull(accountOwnershipTransfers.cancelledAt)
        )
      )
      .returning({ id: accountOwnershipTransfers.id });

    if (!cancelled) {
      throw ApiErrors.notFound("Ownership transfer");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.ACCOUNT_OWNERSHIP_TRANSFER_CANCELLED,
      resource: `account:${accountId}`,
      metadata: { transferId },
    });
  }

  async getPending(accountId: string): Promise<IOwnershipTransfer | null> {
    const [row] = await db
      .select()
      .from(accountOwnershipTransfers)
      .where(
        and(
          eq(accountOwnershipTransfers.accountId, accountId),
          isNull(accountOwnershipTransfers.acceptedAt),
          isNull(accountOwnershipTransfers.declinedAt),
          isNull(accountOwnershipTransfers.cancelledAt)
        )
      )
      .limit(1);

    return row !== undefined && isLiveOwnershipTransfer(row)
      ? toOwnershipTransfer(row)
      : null;
  }

  private async fireTargetNotification(
    transferId: string,
    rawToken: string
  ): Promise<void> {
    /*
     * One query over the transfer row: the recipient (toUser) and account
     * are required inner joins; the originator (fromUser) is a left join so
     * a since-deleted sender still lets the notice go out with an empty
     * fromUserEmail, matching the prior per-query fallback.
     */
    const fromUser = alias(users, "from_user");
    const toUser = alias(users, "to_user");

    const [row] = await db
      .select({
        accountName: accounts.name,
        toEmail: toUser.email,
        fromEmail: fromUser.email,
        expiresAt: accountOwnershipTransfers.expiresAt,
      })
      .from(accountOwnershipTransfers)
      .innerJoin(accounts, eq(accounts.id, accountOwnershipTransfers.accountId))
      .innerJoin(toUser, eq(toUser.id, accountOwnershipTransfers.toUserId))
      .leftJoin(fromUser, eq(fromUser.id, accountOwnershipTransfers.fromUserId))
      .where(eq(accountOwnershipTransfers.id, transferId))
      .limit(1);

    if (!row) {
      return;
    }

    await dispatchOwnershipTransferEmail({
      toEmail: row.toEmail,
      accountName: row.accountName,
      fromUserEmail: row.fromEmail ?? "",
      rawToken,
      acceptUrl: `${env.FRONTEND_URL}/account/ownership-transfer/accept`,
      expiresAt: row.expiresAt,
      transferId,
    });
  }
}

export const ownershipTransfersService = new OwnershipTransfersService();
