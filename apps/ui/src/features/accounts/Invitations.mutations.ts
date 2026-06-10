import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { ACCOUNTS_QUERY_KEYS } from "./Accounts.constants";
import type {
  ICreateInvitationResult,
  IInviteMemberInput
} from "./Accounts.types";

export function useInviteMember(
  accountId: string | undefined
): UseMutationResult<ICreateInvitationResult, unknown, IInviteMemberInput> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: IInviteMemberInput) => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.POST(
        "/api/v1/accounts/{id}/invitations",
        {
          params: { path: { id: accountId } },
          body: input
        }
      );

      if (!data) {
        throw new ApiError(0, { message: "Empty invite response" });
      }

      return data;
    },
    onSuccess: async () => {
      if (accountId !== undefined) {
        await qc.invalidateQueries({
          queryKey: ACCOUNTS_QUERY_KEYS.invitations(accountId)
        });
      }
    }
  });
}

export function useResendInvitation(
  accountId: string | undefined
): UseMutationResult<
  ICreateInvitationResult,
  unknown,
  { invitationId: string }
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invitationId: string }) => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.POST(
        "/api/v1/accounts/{id}/invitations/{invitationId}/resend",
        {
          params: {
            path: { id: accountId, invitationId: input.invitationId }
          }
        }
      );

      if (!data) {
        throw new ApiError(0, { message: "Empty resend response" });
      }

      return data;
    },
    onSuccess: async () => {
      if (accountId !== undefined) {
        await qc.invalidateQueries({
          queryKey: ACCOUNTS_QUERY_KEYS.invitations(accountId)
        });
      }
    }
  });
}

export function useRevokeInvitation(
  accountId: string | undefined
): UseMutationResult<unknown, unknown, { invitationId: string }> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invitationId: string }) => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.DELETE(
        "/api/v1/accounts/{id}/invitations/{invitationId}",
        {
          params: {
            path: { id: accountId, invitationId: input.invitationId }
          }
        }
      );

      return data;
    },
    onSuccess: async () => {
      if (accountId !== undefined) {
        await qc.invalidateQueries({
          queryKey: ACCOUNTS_QUERY_KEYS.invitations(accountId)
        });
      }
    }
  });
}
