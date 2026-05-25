import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import { restoreLists, snapshotLists } from "./Notifications.cache";
import { NOTIFICATIONS_QUERY_KEYS } from "./Notifications.constants";
import type {
  IInfiniteCache,
  IMarkAllReadContext,
  IStatusContext
} from "./Notifications.types";
import {
  applyMarkAllReadToCache,
  applyStatusToCache
} from "./Notifications.utils";

export function useMarkNotificationRead(): UseMutationResult<
  unknown,
  unknown,
  string,
  IStatusContext
> {
  const qc = useQueryClient();

  return useMutation<unknown, unknown, string, IStatusContext>({
    mutationFn: async (id) => {
      await apiClient.PATCH("/api/v1/notifications/{id}", {
        params: { path: { id } },
        body: { status: "read" }
      });

      return undefined;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.list,
        exact: false
      });

      const snapshots = snapshotLists(qc);

      qc.setQueriesData<IInfiniteCache>(
        { queryKey: NOTIFICATIONS_QUERY_KEYS.list },
        (old) => applyStatusToCache(old, id, "read")
      );

      return { snapshots };
    },
    onError: (error, _id, context) => {
      logger.warn({
        event: "notifications.mark_read_failed",
        error: getErrorMessage(error)
      });

      if (context !== undefined) {
        restoreLists(qc, context.snapshots);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEYS.list });
      void qc.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount
      });
    }
  });
}

export function useArchiveNotification(): UseMutationResult<
  unknown,
  unknown,
  string,
  IStatusContext
> {
  const qc = useQueryClient();

  return useMutation<unknown, unknown, string, IStatusContext>({
    mutationFn: async (id) => {
      await apiClient.PATCH("/api/v1/notifications/{id}", {
        params: { path: { id } },
        body: { status: "archived" }
      });

      return undefined;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.list,
        exact: false
      });

      const snapshots = snapshotLists(qc);

      qc.setQueriesData<IInfiniteCache>(
        { queryKey: NOTIFICATIONS_QUERY_KEYS.list },
        (old) => applyStatusToCache(old, id, "archived")
      );

      return { snapshots };
    },
    onError: (error, _id, context) => {
      logger.warn({
        event: "notifications.archive_failed",
        error: getErrorMessage(error)
      });

      if (context !== undefined) {
        restoreLists(qc, context.snapshots);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEYS.list });
      void qc.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount
      });
    }
  });
}

export function useMarkAllNotificationsRead(): UseMutationResult<
  unknown,
  unknown,
  undefined,
  IMarkAllReadContext
> {
  const qc = useQueryClient();

  return useMutation<unknown, unknown, undefined, IMarkAllReadContext>({
    mutationFn: async () => {
      await apiClient.POST("/api/v1/notifications/mark-all-read", {});

      return undefined;
    },
    onMutate: async () => {
      await qc.cancelQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.list,
        exact: false
      });

      const snapshots = snapshotLists(qc);
      const unreadSnapshot = qc.getQueryData<number>(
        NOTIFICATIONS_QUERY_KEYS.unreadCount
      );

      qc.setQueriesData<IInfiniteCache>(
        { queryKey: NOTIFICATIONS_QUERY_KEYS.list },
        (old) => applyMarkAllReadToCache(old)
      );
      qc.setQueryData<number>(NOTIFICATIONS_QUERY_KEYS.unreadCount, 0);

      return { snapshots, unreadSnapshot };
    },
    onError: (error, _vars, context) => {
      logger.warn({
        event: "notifications.mark_all_read_failed",
        error: getErrorMessage(error)
      });

      if (context !== undefined) {
        restoreLists(qc, context.snapshots);
      }

      if (context?.unreadSnapshot !== undefined) {
        qc.setQueryData(
          NOTIFICATIONS_QUERY_KEYS.unreadCount,
          context.unreadSnapshot
        );
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEYS.list });
      void qc.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount
      });
    }
  });
}
