import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";
import type { IMe } from "@/features/auth/Auth.types";

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
      const previousAccountId = qc.getQueryData<IMe | null>(AUTH_QUERY_KEYS.me)
        ?.account.id;
      const isSession = (key: readonly unknown[]) =>
        key.length === 2 && key[0] === "auth" && key[1] === "me";

      await qc.cancelQueries();

      // Reset data without fetching under the previous account's query keys.
      for (const query of qc.getQueryCache().getAll()) {
        if (!isSession(query.queryKey)) {
          query.reset();
        }
      }

      await qc.resetQueries(
        { queryKey: AUTH_QUERY_KEYS.me, exact: true },
        { throwOnError: true }
      );
      qc.removeQueries({
        type: "inactive",
        predicate: (query) => !isSession(query.queryKey)
      });
      await qc.refetchQueries({
        type: "active",
        predicate: (query) =>
          !isSession(query.queryKey) &&
          (previousAccountId === undefined ||
            !query.queryKey.includes(previousAccountId))
      });
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
