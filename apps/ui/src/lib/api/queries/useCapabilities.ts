import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import {
  CAPABILITIES_GC_MS,
  CAPABILITIES_QUERY_KEY,
  CAPABILITIES_STALE_MS
} from "./capabilities.constants";
import type { ICapabilities } from "./capabilities.types";

export function useCapabilities(): UseQueryResult<ICapabilities | null> {
  return useQuery<ICapabilities | null>({
    queryKey: CAPABILITIES_QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/capabilities/");

      return data ?? null;
    },
    staleTime: CAPABILITIES_STALE_MS,
    gcTime: CAPABILITIES_GC_MS
  });
}
