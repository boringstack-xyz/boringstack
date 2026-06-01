import type {
  INotification,
  INotificationListStatus
} from "../../Notifications.types";

export interface INotificationsPageView {
  readonly items: INotification[];
  readonly status: INotificationListStatus | undefined;
  readonly setStatus: (next: INotificationListStatus | undefined) => void;
  readonly onTabChange: (next: string) => void;
  readonly isLoading: boolean;
  readonly isFetchingNextPage: boolean;
  readonly hasNextPage: boolean;
  readonly fetchNextPage: () => void;
  readonly onMarkRead: (id: string) => void;
  readonly onArchive: (id: string) => void;
  readonly onMarkAllRead: () => void;
  readonly isMarkingAllRead: boolean;
  readonly isEmpty: boolean;
}
