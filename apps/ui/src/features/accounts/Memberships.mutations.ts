import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";

/**
 * Mutations that act on the caller's *own* membership: switching the
 * active account, leaving an account. Lifecycle operations on the
 * account itself (rename, transfer, delete) live in
 * `Accounts.mutations.ts`.
 */

export function useSwitchAccount(): UseMutationResult<
  { accountId: string },
  unknown,
  { accountId: string }
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { accountId: string }) => {
      const { data } = await apiClient.POST("/api/v1/accounts/switch", {
        body: { accountId: input.accountId }
      });

      if (!data?.data) {
        throw new ApiError(0, { message: "Empty switch response" });
      }

      return data.data;
    },
    onSuccess: async () => {
      /*
       * The new active account is on the server (JWT cookie was
       * rotated). Drop ALL cached data so account-scoped queries
       * (sites, dashboard, invitations) refetch under the new aid,
       * then refetch /me last so AbilityProvider rebuilds with the
       * new role + features.
       */
      qc.clear();
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}

export function useLeaveAccount(
  accountId: string | undefined
): UseMutationResult<unknown, unknown, void> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.DELETE(
        "/api/v1/accounts/{id}/memberships/me",
        {
          params: { path: { id: accountId } }
        }
      );

      return data;
    },
    onSuccess: () => {
      /*
       * Leaving an account invalidates every account-scoped cache key:
       * the next /me resolves a different default account (or none),
       * so drop everything the same way the account-switch flow does.
       */
      qc.clear();
    }
  });
}
