import { useCallback, useMemo, useState } from "react";

import { useNotificationsList } from "../../Notifications.list.queries";
import {
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead
} from "../../Notifications.mutations";
import type { INotificationListStatus } from "../../Notifications.types";
import { NOTIFICATIONS_PAGE_TABS } from "./NotificationsPage.constants";
import type { INotificationsPageView } from "./NotificationsPage.types";
import { flattenPages } from "./NotificationsPage.utils";

export function useNotificationsPage(): INotificationsPageView {
  const [status, setStatus] = useState<INotificationListStatus | undefined>(
    undefined
  );

  const list = useNotificationsList(status);
  const markRead = useMarkNotificationRead();
  const archive = useArchiveNotification();
  const markAllRead = useMarkAllNotificationsRead();

  const items = useMemo(
    () => flattenPages(list.data?.pages),
    [list.data?.pages]
  );

  const fetchNextPage = useCallback((): void => {
    void list.fetchNextPage();
  }, [list]);

  const onMarkAllRead = useCallback((): void => {
    markAllRead.mutate(undefined);
  }, [markAllRead]);

  const onTabChange = useCallback((next: string): void => {
    const tab = NOTIFICATIONS_PAGE_TABS.find((entry) => entry.value === next);

    setStatus(tab?.status);
  }, []);

  return {
    items,
    status,
    setStatus,
    onTabChange,
    isLoading: list.isPending,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    fetchNextPage,
    onMarkRead: markRead.mutate,
    onArchive: archive.mutate,
    onMarkAllRead,
    isMarkingAllRead: markAllRead.isPending,
    isEmpty: !list.isPending && items.length === 0
  };
}
