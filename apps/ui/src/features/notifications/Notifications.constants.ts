export const NOTIFICATIONS_QUERY_KEYS = {
  list: ["notifications", "list"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  preferences: ["notifications", "preferences"] as const
};

export const NOTIFICATIONS_LIST_PAGE_SIZE = 20;

/*
 * Seed for useInfiniteQuery's cursor pageParam. Declared `string | undefined`
 * so TanStack infers TPageParam correctly; a function-local `undefined` would
 * be control-flow-narrowed to the literal and collapse the type.
 */
export const INITIAL_LIST_CURSOR: string | undefined = undefined;

export const NOTIFICATIONS_ROUTES = {
  index: "/notifications",
  preferences: "/notifications/preferences"
} as const;

export const NOTIFICATION_CHANNELS = ["in-app", "email"] as const;

export const NOTIFICATION_STATUSES = ["unread", "read", "archived"] as const;

export const NOTIFICATION_STREAM_MAX_RECONNECTS = 3;
