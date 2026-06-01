import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";

export function useTransferOwnership(
  accountId: string | undefined
): UseMutationResult<unknown, unknown, { toUserId: string }> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { toUserId: string }) => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.POST(
        "/api/v1/accounts/{id}/transfer-ownership",
        {
          params: { path: { id: accountId } },
          body: input
        }
      );

      return data;
    },
    onSuccess: async () => {
      /*
       * Role on /me will flip from owner to admin. AbilityProvider
       * rebuilds, gating the buttons the former owner used to see.
       */
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}

export function useDeleteAccount(
  accountId: string | undefined
): UseMutationResult<unknown, unknown, void> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.DELETE("/api/v1/accounts/{id}", {
        params: { path: { id: accountId } }
      });

      return data;
    },
    onSuccess: () => {
      qc.clear();
    }
  });
}

export function useUpdateAccount(
  accountId: string | undefined
): UseMutationResult<unknown, unknown, { name: string }> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string }) => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.PATCH("/api/v1/accounts/{id}", {
        params: { path: { id: accountId } },
        body: input
      });

      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}
