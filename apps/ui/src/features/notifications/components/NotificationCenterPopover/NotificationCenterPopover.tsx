import type { FC } from "react";
import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

import { NOTIFICATIONS_ROUTES } from "../../Notifications.constants";
import { NotificationListItem } from "../NotificationListItem";
import { useNotificationCenterPopover } from "./NotificationCenterPopover.hooks";
import type { INotificationCenterPopoverProps } from "./NotificationCenterPopover.types";

const NotificationCenterPopover: FC<INotificationCenterPopoverProps> = (
  props
) => {
  const { t } = useTranslation();
  const { items, isLoading, isError, isEmpty, onMarkRead } =
    useNotificationCenterPopover();

  const renderedItems = items.map((item) => (
    <NotificationListItem
      key={item.id}
      notification={item}
      onMarkRead={onMarkRead}
    />
  ));

  return (
    <Popover>
      <PopoverTrigger asChild>{props.trigger}</PopoverTrigger>
      <PopoverContent align='end' className='w-80 p-0'>
        <PopoverHeader className='border-border border-b px-4 py-3'>
          <PopoverTitle className='text-sm font-semibold tracking-tight'>
            {t("notifications.title")}
          </PopoverTitle>
        </PopoverHeader>

        <ScrollArea className='max-h-80'>
          {isLoading ? (
            <p className='text-muted-foreground px-4 py-6 text-sm'>
              {t("notifications.loading")}
            </p>
          ) : null}

          {isError ? (
            <p className='text-destructive px-4 py-6 text-sm'>
              {t("notifications.loadError")}
            </p>
          ) : null}

          {isEmpty ? (
            <p className='text-muted-foreground px-4 py-6 text-sm'>
              {t("notifications.empty")}
            </p>
          ) : null}

          {renderedItems}
        </ScrollArea>

        <div className='border-border flex justify-end border-t px-3 py-2'>
          <Button asChild type='button' variant='ghost' size='sm'>
            <Link to={NOTIFICATIONS_ROUTES.index}>
              {t("notifications.seeAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

NotificationCenterPopover.displayName = "NotificationCenterPopover";

export default NotificationCenterPopover;
export { NotificationCenterPopover };
