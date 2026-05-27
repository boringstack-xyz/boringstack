import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  accountInvitations,
  accountMemberships,
  accounts,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { sendTemplate } from "../../lib/email";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { notifications } from "../../lib/notifications";
import { now } from "../../lib/time/now";
import { generateOpaqueToken, hashOpaqueToken } from "../../lib/tokens";
import { accountInvitationAcceptedEvent } from "../notifications/events";

import {
  INVITATION_EMAIL_SUBJECT,
  INVITATION_TEMPLATE_PATH,
} from "./invitations.constants";

import type {
  ICreateInvitationInput,
  ICreateInvitationResult,
  IDispatchInvitationEmailInput,
  IInvitation,
} from "./invitations.types";

import {
  computeInvitationExpiresAt,
  normalizeInvitationEmail,
} from "./invitations.utils";

export class InvitationsService {
  /*
   * Fire-and-forget email dispatch. The acceptance flow is the email's
   * delivery target — we never block the route on the email send. On
   * failure the invitation row is still persisted and the operator can
   * resend, so the user-facing API stays predictable.
   */
  private dispatchInvitationEmail(input: IDispatchInvitationEmailInput): void {
    void sendTemplate({
      to: input.toEmail,
      subject: INVITATION_EMAIL_SUBJECT,
      templatePath: INVITATION_TEMPLATE_PATH,
      variables: {
        preHeader: "Accept your invitation to join the team",
        roleToAssign: input.roleToAssign,
        token: input.rawToken,
        acceptUrl: `${env.FRONTEND_URL}/invitations/accept`,
        expiresAt: input.expiresAt,
      },
    }).catch((error: unknown) => {
      logger.error("Invitation email dispatch failed", {
        event: "accounts.invitation.email_failed",
        invitationId: input.invitationId,
        error: getErrorMessage(error),
      });
    });
  }

  async create(
    input: ICreateInvitationInput,
    actorUserId: string
  ): Promise<ICreateInvitationResult> {
    const rawToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);

    const [invitation] = await db
      .insert(accountInvitations)
      .values({
        accountId: input.accountId,
        email: normalizeInvitationEmail(input.email),
        roleToAssign: input.roleToAssign,
        tokenHash,
        invitedByMembershipId: input.invitedByMembershipId,
        expiresAt: computeInvitationExpiresAt(),
      })
      .returning();

    if (!invitation) {
      throw ApiErrors.database("Failed to create invitation");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.MEMBERSHIP_INVITED,
      resource: `invitation:${invitation.id}`,
      metadata: {
        accountId: input.accountId,
        role: input.roleToAssign,
      },
    });

    this.dispatchInvitationEmail({
      invitationId: invitation.id,
      toEmail: invitation.email,
      rawToken,
      roleToAssign: invitation.roleToAssign,
      expiresAt: invitation.expiresAt,
    });

    return { invitation, rawToken };
  }

  async resend(
    accountId: string,
    invitationId: string,
    actorUserId: string
  ): Promise<ICreateInvitationResult> {
    const rawToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);

    const [updated] = await db
      .update(accountInvitations)
      .set({
        tokenHash,
        expiresAt: computeInvitationExpiresAt(),
      })
      .where(
        and(
          eq(accountInvitations.id, invitationId),
          eq(accountInvitations.accountId, accountId),
          isNull(accountInvitations.acceptedAt),
          isNull(accountInvitations.revokedAt)
        )
      )
      .returning();

    if (!updated) {
      throw ApiErrors.notFound("Invitation");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.MEMBERSHIP_INVITED,
      resource: `invitation:${updated.id}`,
      metadata: { accountId, resend: true },
    });

    this.dispatchInvitationEmail({
      invitationId: updated.id,
      toEmail: updated.email,
      rawToken,
      roleToAssign: updated.roleToAssign,
      expiresAt: updated.expiresAt,
    });

    return { invitation: updated, rawToken };
  }

  async revoke(
    accountId: string,
    invitationId: string,
    actorUserId: string
  ): Promise<void> {
    const [revoked] = await db
      .update(accountInvitations)
      .set({ revokedAt: now() })
      .where(
        and(
          eq(accountInvitations.id, invitationId),
          eq(accountInvitations.accountId, accountId),
          isNull(accountInvitations.revokedAt)
        )
      )
      .returning({ id: accountInvitations.id });

    if (!revoked) {
      throw ApiErrors.notFound("Invitation");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.MEMBERSHIP_REVOKED,
      resource: `invitation:${invitationId}`,
      metadata: { accountId },
    });
  }

  async findPending(
    accountId: string,
    invitationId: string
  ): Promise<IInvitation> {
    const [invitation] = await db
      .select()
      .from(accountInvitations)
      .where(
        and(
          eq(accountInvitations.id, invitationId),
          eq(accountInvitations.accountId, accountId),
          isNull(accountInvitations.acceptedAt),
          isNull(accountInvitations.revokedAt)
        )
      )
      .limit(1);

    if (!invitation) {
      throw ApiErrors.notFound("Invitation");
    }

    return invitation;
  }

  async listPending(accountId: string): Promise<IInvitation[]> {
    return db
      .select()
      .from(accountInvitations)
      .where(
        and(
          eq(accountInvitations.accountId, accountId),
          isNull(accountInvitations.acceptedAt),
          isNull(accountInvitations.revokedAt)
        )
      );
  }

  async accept(
    token: string,
    userId: string,
    userEmail: string
  ): Promise<IInvitation> {
    const tokenHash = hashOpaqueToken(token);
    const normalizedUserEmail = normalizeInvitationEmail(userEmail);

    return db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(accountInvitations)
        .where(
          and(
            eq(accountInvitations.tokenHash, tokenHash),
            isNull(accountInvitations.acceptedAt),
            isNull(accountInvitations.revokedAt)
          )
        )
        .limit(1);

      if (!invitation) {
        throw ApiErrors.notFound("Invitation");
      }

      if (new Date(invitation.expiresAt) <= new Date()) {
        throw ApiErrors.validation("Invitation has expired");
      }

      if (normalizeInvitationEmail(invitation.email) !== normalizedUserEmail) {
        throw ApiErrors.forbidden(
          "Invitation can only be accepted by the invited email address"
        );
      }

      const [accepted] = await tx
        .update(accountInvitations)
        .set({ acceptedAt: now() })
        .where(
          and(
            eq(accountInvitations.id, invitation.id),
            eq(accountInvitations.accountId, invitation.accountId),
            isNull(accountInvitations.acceptedAt),
            isNull(accountInvitations.revokedAt)
          )
        )
        .returning();

      if (!accepted) {
        throw ApiErrors.database("Failed to mark invitation accepted");
      }

      await tx.insert(accountMemberships).values({
        accountId: invitation.accountId,
        userId,
        role: invitation.roleToAssign,
        invitedByUserId: null,
      });

      void auditLogService.record({
        userId,
        action: AUDIT_ACTIONS.MEMBERSHIP_ACCEPTED,
        resource: `invitation:${invitation.id}`,
        metadata: {
          accountId: invitation.accountId,
          role: invitation.roleToAssign,
        },
      });

      /*
       * Resolve the inviter (the membership-id stored on the
       * invitation row → userId) inside the same tx so the
       * notification target is read-consistent with the membership
       * insert. Falls back to no-op if the inviter row is gone (e.g.
       * the inviter left the account before the invitee accepted).
       */
      let inviterUserId: string | null = null;

      if (invitation.invitedByMembershipId !== null) {
        const [inviterRow] = await tx
          .select({ inviterUserId: accountMemberships.userId })
          .from(accountMemberships)
          .where(
            and(
              eq(accountMemberships.id, invitation.invitedByMembershipId),
              eq(accountMemberships.accountId, invitation.accountId)
            )
          )
          .limit(1);

        inviterUserId = inviterRow?.inviterUserId ?? null;
      }

      if (inviterUserId !== null) {
        const [accountRow] = await tx
          .select({ name: accounts.name })
          .from(accounts)
          .where(eq(accounts.id, invitation.accountId))
          .limit(1);

        void notifications.send(accountInvitationAcceptedEvent, {
          recipientUserId: inviterUserId,
          payload: {
            accountId: invitation.accountId,
            accountName: accountRow?.name ?? "",
            inviteeEmail: userEmail,
            membershipsUrl: `${env.FRONTEND_URL}/account/settings`,
          },
        });
      }

      return accepted;
    });
  }
}

export const invitationsService = new InvitationsService();
