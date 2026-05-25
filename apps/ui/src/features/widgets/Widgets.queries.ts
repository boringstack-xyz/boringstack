import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { WIDGETS_QUERY_KEYS } from "./Widgets.constants";
import type { IWidget } from "./Widgets.types";

export function useWidgets(): UseQueryResult<IWidget[]> {
  return useQuery({
    queryKey: WIDGETS_QUERY_KEYS.list,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/widgets/");

      return data?.items ?? [];
    }
  });
}
