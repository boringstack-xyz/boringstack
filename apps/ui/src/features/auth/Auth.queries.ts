import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import { isAuthenticatedMe } from "./Auth.queries.utils";
import type { IMe, IMfaStatusResponse } from "./Auth.types";

/*
 * Query contract:
 *
 *   - data: IMe      → authenticated session
 *   - data: null     → server returned 200 + { user: null } (anonymous probe)
 *   - error: ApiError(401|403) → forced logout (cookie present but invalid)
 *   - error: other   → real failure (network, 5xx, parse). ProtectedRoute
 *                      renders the offline fallback with a retry CTA.
 *
 * `retry: false` because TanStack Query's default 3-retry exponential
 * backoff would mask an outage for ~10s behind a spinner; the offline
 * fallback is the user-facing retry surface.
 */
export function useMe(): UseQueryResult<IMe | null> {
  return useQuery<IMe | null>({
    queryKey: AUTH_QUERY_KEYS.me,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/users/me");

      return isAuthenticatedMe(data) ? data : null;
    },
    staleTime: 60_000,
    retry: false
  });
}

export function useMfaStatus(): UseQueryResult<IMfaStatusResponse | null> {
  return useQuery<IMfaStatusResponse | null>({
    queryKey: AUTH_QUERY_KEYS.mfaStatus,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/auth/mfa/status");

      return data?.data ?? null;
    },
    staleTime: 60_000,
    retry: false
  });
}
