export interface INotificationBellProps {
  readonly className?: string;
}

export interface INotificationBellView {
  readonly unreadCount: number;
  readonly hasUnread: boolean;
  readonly ariaLabel: string;
}
