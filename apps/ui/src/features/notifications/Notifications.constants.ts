export const NOTIFICATIONS_QUERY_KEYS = {
  list: ["notifications", "list"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  preferences: ["notifications", "preferences"] as const
};

export const NOTIFICATIONS_LIST_PAGE_SIZE = 20;

export const NOTIFICATIONS_ROUTES = {
  index: "/notifications",
  preferences: "/notifications/preferences"
} as const;

export const NOTIFICATION_CHANNELS = ["in-app", "email"] as const;

export const NOTIFICATION_STATUSES = ["unread", "read", "archived"] as const;

export const NOTIFICATION_STREAM_MAX_RECONNECTS = 3;
