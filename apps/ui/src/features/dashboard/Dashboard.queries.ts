import {
  type UseInfiniteQueryResult,
  type UseQueryResult,
  useInfiniteQuery,
  useQuery
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { DASHBOARD_QUERY_KEYS } from "./Dashboard.constants";
import type { IActivityPage, IDashboardSummary } from "./Dashboard.types";

export function useDashboardPendingInvitations(
  accountId: string | undefined
): UseQueryResult<number> {
  return useQuery({
    queryKey: [
      ...DASHBOARD_QUERY_KEYS.summary,
      "invitations",
      accountId
    ] as const,
    enabled: accountId !== undefined,
    queryFn: async () => {
      if (accountId === undefined) {
        return 0;
      }

      const { data } = await apiClient.GET(
        "/api/v1/accounts/{id}/invitations",
        { params: { path: { id: accountId } } }
      );

      return data?.length ?? 0;
    }
  });
}

export function useDashboardUnreadCount(): UseQueryResult<number> {
  return useQuery({
    queryKey: [
      ...DASHBOARD_QUERY_KEYS.summary,
      "unread-notifications"
    ] as const,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/notifications/", {
        params: { query: { status: "unread", limit: "1" } }
      });

      return data?.items.filter((item) => item.status === "unread").length ?? 0;
    }
  });
}

/*
 * ----------------------------------------------------------------------------
 * Plain query — read once, cache, refetch on mount.
 * ----------------------------------------------------------------------------
 */

export function useDashboardSummary(): UseQueryResult<IDashboardSummary> {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.summary,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/dashboard/summary");

      if (!data) {
        throw new Error("Empty dashboard response");
      }

      return data;
    }
  });
}

/*
 * ----------------------------------------------------------------------------
 * Infinite query — canonical pagination pattern.
 *
 * Backend contract: GET /api/v1/dashboard/activity?cursor=<x>&limit=<n>
 *   → { items: ActivityItem[]; nextCursor: string | null }
 *
 * `nextCursor === null` means "no more pages". TanStack Query stops calling
 * `fetchNextPage` automatically once that signal arrives.
 * ----------------------------------------------------------------------------
 */

export function useActivityFeed(): UseInfiniteQueryResult<
  { pages: IActivityPage[]; pageParams: (string | undefined)[] },
  unknown
> {
  return useInfiniteQuery({
    queryKey: DASHBOARD_QUERY_KEYS.activity,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await apiClient.GET("/api/v1/dashboard/activity", {
        params: { query: { cursor: pageParam, limit: "20" } }
      });

      if (!data) {
        throw new Error("Empty activity response");
      }

      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}
