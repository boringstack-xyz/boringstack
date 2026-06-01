import { useCallback } from "react";

import type { INotificationListItemProps } from "./NotificationListItem.types";

export interface INotificationListItemView {
  readonly handleMarkRead: () => void;
  readonly handleArchive: () => void;
}

export function useNotificationListItem(
  props: INotificationListItemProps
): INotificationListItemView {
  const { notification, onMarkRead, onArchive } = props;

  const handleMarkRead = useCallback((): void => {
    onMarkRead?.(notification.id);
  }, [onMarkRead, notification.id]);

  const handleArchive = useCallback((): void => {
    onArchive?.(notification.id);
  }, [onArchive, notification.id]);

  return { handleMarkRead, handleArchive };
}
