import {
  type UseInfiniteQueryResult,
  type UseQueryResult,
  useInfiniteQuery,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import {
  NOTIFICATIONS_LIST_PAGE_SIZE,
  NOTIFICATIONS_QUERY_KEYS
} from "./Notifications.constants";
import type {
  IInfiniteCache,
  INotificationListStatus
} from "./Notifications.types";
import { countUnread } from "./Notifications.utils";

export function useNotificationsList(
  status?: INotificationListStatus
): UseInfiniteQueryResult<IInfiniteCache, unknown> {
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEYS.list, status ?? "all"] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/notifications/", {
        params: {
          query: {
            status,
            limit: String(NOTIFICATIONS_LIST_PAGE_SIZE)
          }
        }
      });

      if (!data) {
        throw new Error("Empty notifications response");
      }

      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}

export function useUnreadNotificationCount(): UseQueryResult<number> {
  const qc = useQueryClient();

  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount,
    queryFn: async () => {
      const cached = qc.getQueriesData<IInfiniteCache>({
        queryKey: NOTIFICATIONS_QUERY_KEYS.list
      });

      for (const [, data] of cached) {
        if (data !== undefined) {
          return countUnread(data.pages);
        }
      }

      const { data } = await apiClient.GET("/api/v1/notifications/", {
        params: { query: { status: "unread", limit: "1" } }
      });

      if (!data) {
        throw new Error("Empty notifications response");
      }

      return countUnread([data]);
    }
  });
}
