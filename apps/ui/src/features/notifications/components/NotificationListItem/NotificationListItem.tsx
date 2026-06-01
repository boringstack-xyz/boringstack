import type { FC } from "react";
import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";
import { sanitizeTargetPath } from "@/lib/web-push/sw-url-sanitize";

import { Button } from "@/components/ui/button";

import { useNotificationListItem } from "./NotificationListItem.hooks";
import type { INotificationListItemProps } from "./NotificationListItem.types";
import { previewBody } from "./NotificationListItem.utils";

const NotificationListItem: FC<INotificationListItemProps> = (props) => {
  const { notification, onMarkRead, onArchive } = props;
  const { t } = useTranslation();
  const { handleMarkRead, handleArchive } = useNotificationListItem(props);

  const isUnread = notification.status === "unread";

  return (
    <article
      data-testid='notification-list-item'
      data-status={notification.status}
      className={cn(
        "border-border hover:bg-primary-low/20 flex flex-col gap-1 border-b px-4 py-4 text-sm transition-colors last:border-b-0",
        isUnread ? "bg-primary-low/20" : undefined
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <p className='text-foreground font-semibold'>{notification.title}</p>
        <time
          dateTime={notification.createdAt}
          className='text-muted-foreground shrink-0 text-xs'
        >
          {new Date(notification.createdAt).toLocaleDateString()}
        </time>
      </div>

      <p className='text-muted-foreground'>{previewBody(notification.body)}</p>

      <div className='mt-2 flex items-center gap-2'>
        {notification.ctaUrl !== null ? (
          <Button asChild type='button' variant='link' size='sm'>
            {/*
             * sanitizeTargetPath collapses off-origin / malformed CTA URLs
             * to "/" — same allowlist the web-push service worker uses, so
             * push and in-app render paths can't drift apart.
             */}
            <Link
              to={sanitizeTargetPath(
                notification.ctaUrl,
                window.location.origin
              )}
            >
              {notification.ctaLabel ?? t("notifications.openCta")}
            </Link>
          </Button>
        ) : null}

        {onMarkRead && isUnread ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={handleMarkRead}
          >
            {t("notifications.markAsRead")}
          </Button>
        ) : null}

        {onArchive && notification.status !== "archived" ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={handleArchive}
          >
            {t("notifications.archive")}
          </Button>
        ) : null}
      </div>
    </article>
  );
};

NotificationListItem.displayName = "NotificationListItem";

export default NotificationListItem;
export { NotificationListItem };
