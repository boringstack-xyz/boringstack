import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import type { IMe } from "./Auth.types";

export function useMe(): UseQueryResult<IMe | null> {
  return useQuery<IMe | null>({
    queryKey: AUTH_QUERY_KEYS.me,
    queryFn: async () => {
      try {
        const { data } = await apiClient.GET("/api/v1/users/me");

        return data ?? null;
      } catch (error) {
        /*
         * 401/403 → not authenticated → null → ProtectedRoute redirects
         * to /login. Network-class failures (no ApiError instance — fetch
         * threw before we got a response) get the same treatment so a
         * transient outage doesn't crash into RouteErrorBoundary; the
         * background refetch recovers once connectivity returns.
         *
         * Real 4xx (other than auth) and any 5xx propagate — those are
         * server bugs the operator needs to see, not "send the user to
         * login and hide the problem."
         */
        if (!(error instanceof ApiError)) {
          return null;
        }

        if (error.isUnauthorized || error.isForbidden) {
          return null;
        }

        throw error;
      }
    },
    staleTime: 60_000
  });
}
