import type { QueryClient } from "@tanstack/react-query";

import { now } from "@/lib/time/now";

import { NOTIFICATIONS_QUERY_KEYS } from "./Notifications.constants";
import type {
  IInfiniteCache,
  INotification,
  INotificationPage
} from "./Notifications.types";

export function countUnread(pages: INotificationPage[] | undefined): number {
  if (pages === undefined) {
    return 0;
  }

  let count = 0;

  for (const page of pages) {
    for (const item of page.items) {
      if (item.status === "unread") {
        count += 1;
      }
    }
  }

  return count;
}

export function applyStatusToCache(
  cache: IInfiniteCache | undefined,
  id: string,
  nextStatus: INotification["status"]
): IInfiniteCache | undefined {
  if (cache === undefined) {
    return cache;
  }

  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
              readAt: nextStatus === "read" ? now() : item.readAt
            }
          : item
      )
    }))
  };
}

export function applyMarkAllReadToCache(
  cache: IInfiniteCache | undefined
): IInfiniteCache | undefined {
  if (cache === undefined) {
    return cache;
  }

  const currentTs = now();

  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.status === "unread"
          ? { ...item, status: "read", readAt: currentTs }
          : item
      )
    }))
  };
}

export function prependNotificationToCache(
  cache: IInfiniteCache | undefined,
  notification: INotification
): IInfiniteCache | undefined {
  if (cache === undefined || cache.pages.length === 0) {
    return cache;
  }

  const [firstPage, ...rest] = cache.pages;

  if (firstPage === undefined) {
    return cache;
  }

  const alreadyPresent = firstPage.items.some(
    (item) => item.id === notification.id
  );

  if (alreadyPresent) {
    return cache;
  }

  return {
    ...cache,
    pages: [
      { ...firstPage, items: [notification, ...firstPage.items] },
      ...rest
    ]
  };
}

export function mergeStreamNotificationIntoCache(
  qc: QueryClient,
  notification: INotification
): void {
  qc.setQueriesData<IInfiniteCache>(
    { queryKey: NOTIFICATIONS_QUERY_KEYS.list },
    (old) => prependNotificationToCache(old, notification)
  );

  qc.setQueryData<number>(
    NOTIFICATIONS_QUERY_KEYS.unreadCount,
    (old) => (old ?? 0) + (notification.status === "unread" ? 1 : 0)
  );
}
