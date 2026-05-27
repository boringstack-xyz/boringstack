import { t } from "elysia";

import { ROLE } from "../../lib/acl";

const RoleLiteral = t.Union([
  t.Literal(ROLE.admin),
  t.Literal(ROLE.member),
  t.Literal(ROLE.viewer),
]);

export const CreateInvitationSchema = t.Object({
  email: t.String({ format: "email", maxLength: 320 }),
  roleToAssign: RoleLiteral,
});

export const AcceptInvitationSchema = t.Object({
  token: t.String({ minLength: 16, maxLength: 255 }),
});

export const InvitationResponse = t.Object({
  id: t.String(),
  accountId: t.String(),
  email: t.String(),
  roleToAssign: t.String(),
  expiresAt: t.String(),
  /*
   * `rawToken` is the unhashed acceptance secret. In production it ONLY
   * travels via the invitation email; the API response omits it so it
   * never lands in proxy logs / browser network panels / audit trails.
   *
   * In non-production environments we keep it in the response so dev
   * UX and the integration test suite can drive the accept flow without
   * a configured email provider.
   */
  rawToken: t.Optional(t.String()),
});

export const PendingInvitationSchema = t.Object({
  id: t.String(),
  accountId: t.String(),
  email: t.String(),
  roleToAssign: t.String(),
  expiresAt: t.String(),
});

export const PendingInvitationsResponse = t.Array(PendingInvitationSchema);

export const AcceptInvitationResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({ accepted: t.Boolean() }),
  timestamp: t.String(),
});

export const TransferOwnershipSchema = t.Object({
  toUserId: t.String({ format: "uuid" }),
});

export const SwitchAccountSchema = t.Object({
  accountId: t.String({ format: "uuid" }),
});

export const SwitchAccountResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({ accountId: t.String() }),
  timestamp: t.String(),
});

export const UpdateAccountSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
});

export const AccountResponse = t.Object({
  id: t.String(),
  name: t.String(),
});

export const JoinRequestSchema = t.Object({
  id: t.String(),
  accountId: t.String(),
  userId: t.String(),
  email: t.String(),
  status: t.Union([
    t.Literal("pending"),
    t.Literal("approved"),
    t.Literal("denied"),
  ]),
  createdAt: t.String(),
  decidedAt: t.Union([t.String(), t.Null()]),
  decidedByUserId: t.Union([t.String(), t.Null()]),
});

export const PendingJoinRequestsResponse = t.Array(JoinRequestSchema);

export const JoinRequestResponse = t.Object({
  success: t.Boolean(),
  data: JoinRequestSchema,
  timestamp: t.String(),
});

export const OwnershipTransferSchema = t.Object({
  id: t.String(),
  accountId: t.String(),
  fromUserId: t.String(),
  toUserId: t.String(),
  expiresAt: t.String(),
  acceptedAt: t.Union([t.String(), t.Null()]),
  declinedAt: t.Union([t.String(), t.Null()]),
  cancelledAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

export const InitiateOwnershipTransferResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({
    transfer: OwnershipTransferSchema,
    /*
     * `rawToken` is the unhashed acceptance secret. In production it
     * ONLY travels via the transfer email; the API response omits it
     * so it never lands in proxy logs / browser network panels.
     * Kept in non-prod responses so the integration test suite can
     * drive the accept flow without a configured email provider.
     */
    rawToken: t.Optional(t.String()),
  }),
  timestamp: t.String(),
});

export const OwnershipTransferTokenSchema = t.Object({
  token: t.String({ minLength: 16, maxLength: 255 }),
});

export const OwnershipTransferResponse = t.Object({
  success: t.Boolean(),
  data: OwnershipTransferSchema,
  timestamp: t.String(),
});

export const PendingOwnershipTransferResponse = t.Object({
  pending: t.Union([OwnershipTransferSchema, t.Null()]),
});
