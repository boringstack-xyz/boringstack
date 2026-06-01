import { useTranslation } from "react-i18next";

import { useUnreadNotificationCount } from "../../Notifications.list.queries";
import type { INotificationBellView } from "./NotificationBell.types";

export function useNotificationBell(): INotificationBellView {
  const { t } = useTranslation();
  const unread = useUnreadNotificationCount();
  const unreadCount = unread.data ?? 0;

  return {
    unreadCount,
    hasUnread: unreadCount > 0,
    ariaLabel:
      unreadCount > 0
        ? t("notifications.bellAriaLabelWithCount", { count: unreadCount })
        : t("notifications.bellAriaLabel")
  };
}
