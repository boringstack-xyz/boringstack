import { t } from "elysia";

import { env } from "../../config/env";
import { isAdminRole, isOwnerRole } from "../../lib/acl";
import { auditLogService } from "../../lib/audit-log";
import { AUTH_COOKIE_CONFIG, AUTH_COOKIE_NAME } from "../../lib/cookies";
import { ApiErrors, createSuccessResponse } from "../../lib/errors";
import { buildJWTPayload } from "../../lib/jwt";
import { emailRateLimiter } from "../../lib/rate-limit/email-rate-limit";
import { errorHandler } from "../../middleware/error-handler";
import {
  resolveActiveMembership,
  resolveFreshMembership,
} from "../../middleware/require-active-membership";
import { createAuthMiddleware } from "../auth/auth.plugin";

import { accountsService } from "./accounts.service";
import {
  AcceptInvitationResponse,
  AcceptInvitationSchema,
  AccountResponse,
  AuditLogListQuerySchema,
  AuditLogListResponse,
  CreateInvitationSchema,
  InitiateOwnershipTransferResponse,
  InvitationResponse,
  JoinRequestResponse,
  OwnershipTransferResponse,
  OwnershipTransferTokenSchema,
  PendingInvitationsResponse,
  PendingJoinRequestsResponse,
  PendingOwnershipTransferResponse,
  SwitchAccountResponse,
  SwitchAccountSchema,
  TransferOwnershipSchema,
  UpdateAccountSchema,
} from "./accounts.schemas";
import { invitationsService } from "./invitations.service";
import { joinRequestsService } from "./join-requests.service";
import { ownershipTransfersService } from "./ownership-transfers.service";

const accountsRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .derive(async ({ user, accountId }) => ({
    membership: await resolveActiveMembership(user.id, accountId),
  }))
  .get(
    "/:id/invitations",
    async ({ membership, params }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden(
          "Cannot list invitations for another account"
        );
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden(
          "Only an owner or admin can list invitations"
        );
      }

      const rows = await invitationsService.listPending(membership.accountId);

      return rows.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        email: row.email,
        roleToAssign: row.roleToAssign,
        expiresAt: row.expiresAt,
      }));
    },
    {
      params: t.Object({ id: t.String() }),
      response: PendingInvitationsResponse,
      detail: {
        tags: ["Accounts"],
        summary: "List pending (not accepted, not revoked) invitations",
      },
    }
  )
  .post(
    "/:id/invitations",
    async ({ membership, params, body, user }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden(
          "Cannot create an invitation for another account"
        );
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden("Only an account owner or admin can invite");
      }

      if (!emailRateLimiter.check(body.email)) {
        throw ApiErrors.validation(
          "Too many invitation emails for this address. Please wait a few minutes.",
          "email"
        );
      }

      const { invitation, rawToken } = await invitationsService.create(
        {
          accountId: membership.accountId,
          email: body.email,
          roleToAssign: body.roleToAssign,
          invitedByMembershipId: membership.id,
        },
        user.id
      );

      return {
        id: invitation.id,
        accountId: invitation.accountId,
        email: invitation.email,
        roleToAssign: invitation.roleToAssign,
        expiresAt: invitation.expiresAt,
        ...(env.isProduction ? {} : { rawToken }),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: CreateInvitationSchema,
      response: InvitationResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Invite a teammate to an account",
      },
    }
  )
  .post(
    "/:id/invitations/:invitationId/resend",
    async ({ membership, params, user }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden();
      }

      const pending = await invitationsService.findPending(
        membership.accountId,
        params.invitationId
      );

      if (!emailRateLimiter.check(pending.email)) {
        throw ApiErrors.validation(
          "Too many invitation emails for this address. Please wait a few minutes.",
          "email"
        );
      }

      const { invitation, rawToken } = await invitationsService.resend(
        membership.accountId,
        params.invitationId,
        user.id
      );

      return {
        id: invitation.id,
        accountId: invitation.accountId,
        email: invitation.email,
        roleToAssign: invitation.roleToAssign,
        expiresAt: invitation.expiresAt,
        ...(env.isProduction ? {} : { rawToken }),
      };
    },
    {
      params: t.Object({ id: t.String(), invitationId: t.String() }),
      response: InvitationResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Resend (and rotate) an invitation token",
      },
    }
  )
  .patch(
    "/:id",
    async ({ membership, params, body, user }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden("Only an account owner or admin can rename");
      }

      return accountsService.updateName(
        membership.accountId,
        body.name,
        user.id
      );
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateAccountSchema,
      response: AccountResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Rename the active account",
      },
    }
  )
  .post(
    "/:id/transfer-ownership",
    async ({ membership, params, body, user }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      const fresh = await resolveFreshMembership(user.id, membership.accountId);

      if (!isOwnerRole(fresh.role)) {
        throw ApiErrors.forbidden(
          "Only the current owner can transfer ownership"
        );
      }

      const { transfer, rawToken } = await ownershipTransfersService.initiate({
        accountId: membership.accountId,
        fromUserId: user.id,
        toUserId: body.toUserId,
        actorUserId: user.id,
      });

      return createSuccessResponse({
        transfer,
        ...(env.isProduction ? {} : { rawToken }),
      });
    },
    {
      params: t.Object({ id: t.String() }),
      body: TransferOwnershipSchema,
      response: InitiateOwnershipTransferResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Initiate a two-step ownership transfer (target must accept)",
      },
    }
  )
  .get(
    "/:id/transfer-ownership/pending",
    async ({ membership, params }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden();
      }

      const pending = await ownershipTransfersService.getPending(
        membership.accountId
      );

      return { pending };
    },
    {
      params: t.Object({ id: t.String() }),
      response: PendingOwnershipTransferResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Get the pending ownership transfer offer, if any",
      },
    }
  )
  .get(
    "/:id/audit-log",
    async ({ membership, params, query }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden(
          "Only an owner or admin can view the audit log"
        );
      }

      return auditLogService.listForAccount({
        accountId: membership.accountId,
        limit: query.limit,
      });
    },
    {
      params: t.Object({ id: t.String() }),
      query: AuditLogListQuerySchema,
      response: AuditLogListResponse,
      detail: {
        tags: ["Accounts"],
        summary:
          "Recent audit-log entries scoped to the account (owner/admin only)",
      },
    }
  )
  .delete(
    "/:id/transfer-ownership/:transferId",
    async ({ membership, params, user, set }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      const fresh = await resolveFreshMembership(user.id, membership.accountId);

      if (!isOwnerRole(fresh.role)) {
        throw ApiErrors.forbidden(
          "Only the current owner can cancel an outstanding transfer"
        );
      }

      await ownershipTransfersService.cancel(
        membership.accountId,
        params.transferId,
        user.id
      );
      set.status = 204;

      return null;
    },
    {
      params: t.Object({ id: t.String(), transferId: t.String() }),
      response: t.Null(),
      detail: {
        tags: ["Accounts"],
        summary: "Cancel a pending ownership transfer offer",
      },
    }
  )
  .delete(
    "/:id",
    async ({ membership, params, user, set }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      const fresh = await resolveFreshMembership(user.id, membership.accountId);

      if (!isOwnerRole(fresh.role)) {
        throw ApiErrors.forbidden("Only the owner can delete the account");
      }

      await accountsService.softDelete(membership.accountId, user.id);
      set.status = 204;

      return null;
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Null(),
      detail: {
        tags: ["Accounts"],
        summary:
          "Soft-delete the account (30-day grace + background hard-delete)",
      },
    }
  )
  .delete(
    "/:id/memberships/me",
    async ({ membership, params, user, set }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      await accountsService.leaveAccount(user.id, membership.accountId);
      set.status = 204;

      return null;
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Null(),
      detail: {
        tags: ["Accounts"],
        summary:
          "Leave the account (revokes the caller's own membership; owner must transfer first)",
      },
    }
  )
  .delete(
    "/:id/invitations/:invitationId",
    async ({ membership, params, user, set }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden();
      }

      await invitationsService.revoke(
        membership.accountId,
        params.invitationId,
        user.id
      );
      set.status = 204;

      return null;
    },
    {
      params: t.Object({ id: t.String(), invitationId: t.String() }),
      response: t.Null(),
      detail: { tags: ["Accounts"], summary: "Revoke an invitation" },
    }
  )
  .get(
    "/:id/join-requests",
    async ({ membership, params }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden(
          "Cannot list join requests for another account"
        );
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden(
          "Only an owner or admin can review join requests"
        );
      }

      return joinRequestsService.listPending(membership.accountId);
    },
    {
      params: t.Object({ id: t.String() }),
      response: PendingJoinRequestsResponse,
      detail: {
        tags: ["Accounts"],
        summary: "List pending domain-claim join requests",
      },
    }
  )
  .post(
    "/:id/join-requests/:requestId/approve",
    async ({ membership, params, user }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden();
      }

      const request = await joinRequestsService.approve(
        membership.accountId,
        params.requestId,
        user.id
      );

      return createSuccessResponse(request);
    },
    {
      params: t.Object({ id: t.String(), requestId: t.String() }),
      response: JoinRequestResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Approve a pending join request (creates a member seat)",
      },
    }
  )
  .post(
    "/:id/join-requests/:requestId/deny",
    async ({ membership, params, user }) => {
      if (params.id !== membership.accountId) {
        throw ApiErrors.forbidden();
      }

      if (!isOwnerRole(membership.role) && !isAdminRole(membership.role)) {
        throw ApiErrors.forbidden();
      }

      const request = await joinRequestsService.deny(
        membership.accountId,
        params.requestId,
        user.id
      );

      return createSuccessResponse(request);
    },
    {
      params: t.Object({ id: t.String(), requestId: t.String() }),
      response: JoinRequestResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Deny a pending join request",
      },
    }
  );

/*
 * Accept lives outside the membership-gated chain because the
 * invitee is authenticated but doesn't yet belong to the target
 * account.
 */
const invitationAcceptRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/accept",
    async ({ body, user }) => {
      await invitationsService.accept(body.token, user.id, user.email);

      return createSuccessResponse({ accepted: true });
    },
    {
      body: AcceptInvitationSchema,
      response: AcceptInvitationResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Accept an invitation by its raw token",
      },
    }
  )
  .post(
    "/ownership-transfer/accept",
    async ({ body, user }) => {
      const transfer = await ownershipTransfersService.accept(
        body.token,
        user.id,
        user.email
      );

      return createSuccessResponse(transfer);
    },
    {
      body: OwnershipTransferTokenSchema,
      response: OwnershipTransferResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Accept an ownership transfer offer by its raw token",
      },
    }
  )
  .post(
    "/ownership-transfer/decline",
    async ({ body, user }) => {
      const transfer = await ownershipTransfersService.decline(
        body.token,
        user.id
      );

      return createSuccessResponse(transfer);
    },
    {
      body: OwnershipTransferTokenSchema,
      response: OwnershipTransferResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Decline an ownership transfer offer by its raw token",
      },
    }
  );

/*
 * Switch lives outside the membership-gated chain because the user
 * is moving FROM the active account TO a different one, so gating
 * on the current active membership would block the very move.
 */
const accountSessionRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/switch",
    async ({ body, user, jwt, cookie }) => {
      await accountsService.switchAccount(user.id, body.accountId);

      const token = await jwt.sign(
        await buildJWTPayload(user.id, user.email, body.accountId)
      );
      const auth = cookie[AUTH_COOKIE_NAME];

      auth?.set({ value: token, ...AUTH_COOKIE_CONFIG });

      return createSuccessResponse({ accountId: body.accountId });
    },
    {
      body: SwitchAccountSchema,
      response: SwitchAccountResponse,
      detail: {
        tags: ["Accounts"],
        summary: "Switch the active account for this session",
      },
    }
  );

export { accountSessionRoutes, accountsRoutes, invitationAcceptRoutes };
export default accountsRoutes;
