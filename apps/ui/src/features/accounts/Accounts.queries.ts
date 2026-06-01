import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { ACCOUNTS_QUERY_KEYS } from "./Accounts.constants";
import type { IPendingInvitation } from "./Accounts.types";

export function useInvitations(
  accountId: string | undefined
): UseQueryResult<IPendingInvitation[]> {
  return useQuery({
    queryKey:
      accountId !== undefined
        ? ACCOUNTS_QUERY_KEYS.invitations(accountId)
        : ["accounts", "no-account", "invitations"],
    enabled: accountId !== undefined,
    queryFn: async () => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.GET(
        "/api/v1/accounts/{id}/invitations",
        { params: { path: { id: accountId } } }
      );

      return data ?? [];
    }
  });
}
