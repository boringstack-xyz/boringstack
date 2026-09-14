import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import type { IMfaStatusResponse } from "./Auth.types";

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
