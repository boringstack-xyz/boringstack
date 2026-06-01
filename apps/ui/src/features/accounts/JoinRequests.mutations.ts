import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { ACCOUNTS_QUERY_KEYS } from "./Accounts.constants";
import type { IJoinRequest } from "./Accounts.types";

export function useApproveJoinRequest(
  accountId: string | undefined
): UseMutationResult<IJoinRequest, unknown, { requestId: string }> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { requestId: string }) => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.POST(
        "/api/v1/accounts/{id}/join-requests/{requestId}/approve",
        {
          params: { path: { id: accountId, requestId: input.requestId } }
        }
      );

      if (!data?.data) {
        throw new ApiError(0, { message: "Empty approve response" });
      }

      return data.data;
    },
    onSuccess: async () => {
      if (accountId !== undefined) {
        await qc.invalidateQueries({
          queryKey: ACCOUNTS_QUERY_KEYS.joinRequests(accountId)
        });
      }
    }
  });
}

export function useDenyJoinRequest(
  accountId: string | undefined
): UseMutationResult<IJoinRequest, unknown, { requestId: string }> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { requestId: string }) => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.POST(
        "/api/v1/accounts/{id}/join-requests/{requestId}/deny",
        {
          params: { path: { id: accountId, requestId: input.requestId } }
        }
      );

      if (!data?.data) {
        throw new ApiError(0, { message: "Empty deny response" });
      }

      return data.data;
    },
    onSuccess: async () => {
      if (accountId !== undefined) {
        await qc.invalidateQueries({
          queryKey: ACCOUNTS_QUERY_KEYS.joinRequests(accountId)
        });
      }
    }
  });
}
