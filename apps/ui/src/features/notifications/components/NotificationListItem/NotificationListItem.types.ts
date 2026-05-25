import type { INotification } from "../../Notifications.types";

export interface INotificationListItemProps {
  readonly notification: INotification;
  readonly onMarkRead?: (id: string) => void;
  readonly onArchive?: (id: string) => void;
}
