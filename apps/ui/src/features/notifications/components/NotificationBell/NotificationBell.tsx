import type { FC } from "react";

import { Bell } from "lucide-react";

import { cn } from "@/lib/classnames";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { NotificationCenterPopover } from "../NotificationCenterPopover";
import { useNotificationBell } from "./NotificationBell.hooks";
import type { INotificationBellProps } from "./NotificationBell.types";
import { formatBadgeCount } from "./NotificationBell.utils";

const NotificationBell: FC<INotificationBellProps> = (props) => {
  const { unreadCount, hasUnread, ariaLabel } = useNotificationBell();

  return (
    <NotificationCenterPopover
      trigger={
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={ariaLabel}
          className={cn("relative", props.className)}
        >
          <Bell className='size-5' />
          {hasUnread ? (
            <Badge
              variant='destructive'
              className='absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 text-[10px] leading-none'
            >
              {formatBadgeCount(unreadCount)}
            </Badge>
          ) : null}
        </Button>
      }
    />
  );
};

NotificationBell.displayName = "NotificationBell";

export default NotificationBell;
export { NotificationBell };
