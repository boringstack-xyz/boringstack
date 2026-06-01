import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";

import type { IOwnershipTransfer } from "./Accounts.types";

/**
 * Token-bearing mutations the ownership-transfer email landing page
 * fires when the recipient clicks accept or decline. Authenticated:
 * the API verifies that the named recipient matches the JWT subject
 * before mutating either timestamp.
 */
export function useAcceptOwnershipTransfer(): UseMutationResult<
  IOwnershipTransfer,
  unknown,
  { token: string }
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { token: string }) => {
      const { data } = await apiClient.POST(
        "/api/v1/invitations/ownership-transfer/accept",
        { body: { token: input.token } }
      );

      if (!data?.data) {
        throw new ApiError(0, {
          message: "Empty ownership-transfer accept response"
        });
      }

      return data.data;
    },
    onSuccess: async () => {
      /*
       * Accepting promotes the recipient to owner and demotes the prior
       * owner; the role-aware UI surfaces live in /me + the membership
       * cache. Drop both so the next paint sees the new role.
       */
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}

export function useDeclineOwnershipTransfer(): UseMutationResult<
  IOwnershipTransfer,
  unknown,
  { token: string }
> {
  return useMutation({
    mutationFn: async (input: { token: string }) => {
      const { data } = await apiClient.POST(
        "/api/v1/invitations/ownership-transfer/decline",
        { body: { token: input.token } }
      );

      if (!data?.data) {
        throw new ApiError(0, {
          message: "Empty ownership-transfer decline response"
        });
      }

      return data.data;
    }
  });
}
