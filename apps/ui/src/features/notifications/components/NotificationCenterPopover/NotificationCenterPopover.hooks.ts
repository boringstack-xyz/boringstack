import { useMemo } from "react";

import { useNotificationsList } from "../../Notifications.list.queries";
import { useMarkNotificationRead } from "../../Notifications.mutations";
import type { INotification } from "../../Notifications.types";
import { NOTIFICATION_CENTER_VISIBLE_LIMIT } from "./NotificationCenterPopover.constants";

export interface INotificationCenterPopoverView {
  readonly items: INotification[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly isEmpty: boolean;
  readonly onMarkRead: (id: string) => void;
}

export function useNotificationCenterPopover(): INotificationCenterPopoverView {
  const list = useNotificationsList();
  const markRead = useMarkNotificationRead();

  const items = useMemo<INotification[]>(() => {
    const pages = list.data?.pages ?? [];
    const all: INotification[] = [];

    for (const page of pages) {
      all.push(...page.items);
    }

    return all.slice(0, NOTIFICATION_CENTER_VISIBLE_LIMIT);
  }, [list.data?.pages]);

  return {
    items,
    isLoading: list.isPending,
    isError: list.isError,
    isEmpty: !list.isPending && !list.isError && items.length === 0,
    onMarkRead: markRead.mutate
  };
}
