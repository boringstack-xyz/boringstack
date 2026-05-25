import type { InferSelectModel } from "drizzle-orm";

import type { accountInvitations } from "../../clients/postgres/schema";
import type { Role } from "../../lib/acl/acl.types";

export type IInvitation = InferSelectModel<typeof accountInvitations>;

export interface ICreateInvitationInput {
  readonly accountId: string;
  readonly email: string;
  readonly roleToAssign: Role;
  readonly invitedByMembershipId: string;
}

export interface ICreateInvitationResult {
  readonly invitation: IInvitation;
  /** The raw token to email; never re-readable from the DB. */
  readonly rawToken: string;
}

export interface IAcceptInvitationInput {
  readonly token: string;
  readonly userId: string;
}

export interface IDispatchInvitationEmailInput {
  readonly invitationId: string;
  readonly toEmail: string;
  readonly rawToken: string;
  readonly roleToAssign: string;
  readonly expiresAt: string;
}
