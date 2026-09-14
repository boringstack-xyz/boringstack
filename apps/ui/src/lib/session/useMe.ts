import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { SESSION_QUERY_KEYS } from "./session.constants";
import type { IMe } from "./session.types";
import { isAuthenticatedMe } from "./session.utils";

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
 *
 * Lives in `lib` rather than the auth feature because every account-scoped
 * feature reads the current user; a feature-to-feature import would need a
 * cross-feature exception for each of them.
 */
export function useMe(): UseQueryResult<IMe | null> {
  return useQuery<IMe | null>({
    queryKey: SESSION_QUERY_KEYS.me,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/users/me");

      return isAuthenticatedMe(data) ? data : null;
    },
    staleTime: 60_000,
    retry: false
  });
}
