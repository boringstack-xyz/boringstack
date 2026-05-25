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

export type IInviteRole = IInviteMemberInput["roleToAssign"];
