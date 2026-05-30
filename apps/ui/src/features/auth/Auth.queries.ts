import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import { isAuthenticatedMe } from "./Auth.queries.utils";
import type { IMe, IMfaStatusResponse } from "./Auth.types";

export function useMe(): UseQueryResult<IMe | null> {
  return useQuery<IMe | null>({
    queryKey: AUTH_QUERY_KEYS.me,
    queryFn: async () => {
      try {
        const { data } = await apiClient.GET("/api/v1/users/me");

        return isAuthenticatedMe(data) ? data : null;
      } catch (error) {
        /*
         * A 401/403 here means the cookie was present but didn't verify
         * (forged, expired, revoked). Resolve to `null` so
         * `ProtectedRoute` redirects to /login — the forced-logout
         * surfaces as the same UX as anonymous, which is the right
         * outcome. Network-class failures get the same treatment so a
         * transient outage doesn't crash into RouteErrorBoundary; the
         * background refetch recovers once connectivity returns. Real
         * 4xx (other than auth) and any 5xx propagate — those are
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

export function useMfaStatus(): UseQueryResult<IMfaStatusResponse | null> {
  return useQuery<IMfaStatusResponse | null>({
    queryKey: AUTH_QUERY_KEYS.mfaStatus,
    queryFn: async () => {
      try {
        const { data } = await apiClient.GET("/api/v1/auth/mfa/status");

        return data?.data ?? null;
      } catch (error) {
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
