import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { ACCOUNTS_QUERY_KEYS } from "./Accounts.constants";
import type { IJoinRequest } from "./Accounts.types";

export function useJoinRequests(
  accountId: string | undefined
): UseQueryResult<IJoinRequest[]> {
  return useQuery({
    queryKey:
      accountId === undefined
        ? ACCOUNTS_QUERY_KEYS.joinRequests("anonymous")
        : ACCOUNTS_QUERY_KEYS.joinRequests(accountId),
    enabled: accountId !== undefined,
    queryFn: async (): Promise<IJoinRequest[]> => {
      if (accountId === undefined) {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.GET(
        "/api/v1/accounts/{id}/join-requests",
        { params: { path: { id: accountId } } }
      );

      return data ?? [];
    }
  });
}
