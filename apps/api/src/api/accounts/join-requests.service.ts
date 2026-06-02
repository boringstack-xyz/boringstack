import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountMemberships,
  accounts,
  accountJoinRequests,
  users,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ROLE } from "../../lib/acl";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { now } from "../../lib/time/now";

import { JOIN_REQUEST_STATUS } from "./join-requests.constants";
import {
  dispatchJoinRequestCreatedEmail,
  toJoinRequest,
} from "./join-requests.utils";
import type {
  ICreateJoinRequestInput,
  IJoinRequest,
} from "./join-requests.types";

import type { DbOrTx } from "./accounts.types";

export class JoinRequestsService {
  /**
   * Inserts a pending join request when a user's verified email
   * matches an already-claimed domain. Idempotent: the partial unique
   * index on (account_id, user_id) WHERE status='pending' makes a
   * duplicate insert a no-op via `onConflictDoNothing`, so retrying the
   * verify-email flow doesn't spam the owner inbox.
   *
   * Returns the existing-or-newly-created request id so the caller can
   * include it in the user-facing "request pending" response.
   */
  async createPending(
    input: ICreateJoinRequestInput,
    txOpt?: DbOrTx
  ): Promise<{ id: string; isNew: boolean }> {
    const tx = txOpt ?? db;

    const [inserted] = await tx
      .insert(accountJoinRequests)
      .values({
        accountId: input.accountId,
        userId: input.userId,
        email: input.email,
        status: JOIN_REQUEST_STATUS.pending,
      })
      .onConflictDoNothing({
        target: [accountJoinRequests.accountId, accountJoinRequests.userId],
        where: eq(accountJoinRequests.status, JOIN_REQUEST_STATUS.pending),
      })
      .returning({ id: accountJoinRequests.id });

    if (inserted) {
      void auditLogService.record({
        userId: input.userId,
        action: AUDIT_ACTIONS.ACCOUNT_JOIN_REQUEST_CREATED,
        resource: `join_request:${inserted.id}`,
        metadata: { accountId: input.accountId },
      });

      this.fireOwnerNotification(input.accountId, inserted.id).catch(
        (error: unknown) => {
          logger.warn("Join request owner notification failed", {
            event: "accounts.join_request.email_failed",
            requestId: inserted.id,
            error: getErrorMessage(error),
          });
        }
      );

      return { id: inserted.id, isNew: true };
    }

    const [existing] = await tx
      .select({ id: accountJoinRequests.id })
      .from(accountJoinRequests)
      .where(
        and(
          eq(accountJoinRequests.accountId, input.accountId),
          eq(accountJoinRequests.userId, input.userId),
          eq(accountJoinRequests.status, JOIN_REQUEST_STATUS.pending)
        )
      )
      .limit(1);

    if (!existing) {
      throw ApiErrors.database(
        "Failed to look up existing pending join request"
      );
    }

    return { id: existing.id, isNew: false };
  }

  async listPending(accountId: string): Promise<IJoinRequest[]> {
    const rows = await db
      .select()
      .from(accountJoinRequests)
      .where(
        and(
          eq(accountJoinRequests.accountId, accountId),
          eq(accountJoinRequests.status, JOIN_REQUEST_STATUS.pending)
        )
      )
      .orderBy(asc(accountJoinRequests.createdAt));

    return rows.map(toJoinRequest);
  }

  /**
   * Approving creates the active membership atomically with the
   * status flip. The acceptance is a single transactional batch so a
   * crash between the two writes can't leave a `approved` request
   * with no membership row.
   */
  async approve(
    accountId: string,
    requestId: string,
    deciderUserId: string
  ): Promise<IJoinRequest> {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(accountJoinRequests)
        .where(
          and(
            eq(accountJoinRequests.id, requestId),
            eq(accountJoinRequests.accountId, accountId),
            eq(accountJoinRequests.status, JOIN_REQUEST_STATUS.pending)
          )
        )
        .limit(1);

      if (!request) {
        throw ApiErrors.notFound("Join request");
      }

      await tx.insert(accountMemberships).values({
        accountId: request.accountId,
        userId: request.userId,
        role: ROLE.member,
        invitedByUserId: deciderUserId,
      });

      const [updated] = await tx
        .update(accountJoinRequests)
        .set({
          status: JOIN_REQUEST_STATUS.approved,
          decidedAt: now(),
          decidedByUserId: deciderUserId,
        })
        .where(
          and(
            eq(accountJoinRequests.id, requestId),
            eq(accountJoinRequests.accountId, accountId),
            eq(accountJoinRequests.status, JOIN_REQUEST_STATUS.pending)
          )
        )
        .returning();

      if (!updated) {
        throw ApiErrors.database("Failed to mark join request approved");
      }

      void auditLogService.record({
        userId: deciderUserId,
        action: AUDIT_ACTIONS.ACCOUNT_JOIN_REQUEST_APPROVED,
        resource: `join_request:${requestId}`,
        metadata: { accountId, requesterId: request.userId },
      });

      return toJoinRequest(updated);
    });
  }

  async deny(
    accountId: string,
    requestId: string,
    deciderUserId: string
  ): Promise<IJoinRequest> {
    const [updated] = await db
      .update(accountJoinRequests)
      .set({
        status: JOIN_REQUEST_STATUS.denied,
        decidedAt: now(),
        decidedByUserId: deciderUserId,
      })
      .where(
        and(
          eq(accountJoinRequests.id, requestId),
          eq(accountJoinRequests.accountId, accountId),
          eq(accountJoinRequests.status, JOIN_REQUEST_STATUS.pending)
        )
      )
      .returning();

    if (!updated) {
      throw ApiErrors.notFound("Join request");
    }

    void auditLogService.record({
      userId: deciderUserId,
      action: AUDIT_ACTIONS.ACCOUNT_JOIN_REQUEST_DENIED,
      resource: `join_request:${requestId}`,
      metadata: { accountId, requesterId: updated.userId },
    });

    return toJoinRequest(updated);
  }

  private async fireOwnerNotification(
    accountId: string,
    requestId: string
  ): Promise<void> {
    const [account] = await db
      .select({ name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      .limit(1);

    if (!account) {
      return;
    }

    const [ownerRow] = await db
      .select({ email: users.email })
      .from(accountMemberships)
      .innerJoin(users, eq(users.id, accountMemberships.userId))
      .where(
        and(
          eq(accountMemberships.accountId, accountId),
          eq(accountMemberships.role, ROLE.owner)
        )
      )
      .limit(1);

    if (!ownerRow) {
      return;
    }

    await dispatchJoinRequestCreatedEmail({
      toEmail: ownerRow.email,
      accountName: account.name,
      reviewUrl: `${env.FRONTEND_URL}/account/requests`,
      requestId,
    });
  }
}

export const joinRequestsService = new JoinRequestsService();
