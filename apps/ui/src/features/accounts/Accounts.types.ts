import type { z } from "zod";

import type { operations } from "@/lib/api/client";

import type { inviteMemberSchema } from "./Accounts.schemas";

export type IInviteMemberInput = z.infer<typeof inviteMemberSchema>;

type ListInvitationsResponse =
  operations["getApiV1AccountsByIdInvitations"]["responses"][200]["content"]["application/json"];

export type IPendingInvitation = ListInvitationsResponse[number];

type CreateInvitationResponse =
  operations["postApiV1AccountsByIdInvitations"]["responses"][200]["content"]["application/json"];

export type ICreateInvitationResult = CreateInvitationResponse;

type ListJoinRequestsResponse =
  operations["getApiV1AccountsByIdJoin-requests"]["responses"][200]["content"]["application/json"];

export type IJoinRequest = ListJoinRequestsResponse[number];

type OwnershipTransferResponse =
  operations["postApiV1InvitationsOwnership-transferAccept"]["responses"][200]["content"]["application/json"]["data"];

export type IOwnershipTransfer = OwnershipTransferResponse;
