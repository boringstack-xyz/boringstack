export const NOTIFICATIONS_PAGE_TABS = [
  { value: "all", labelKey: "notifications.tabs.all", status: undefined },
  {
    value: "unread",
    labelKey: "notifications.tabs.unread",
    status: "unread"
  },
  {
    value: "archived",
    labelKey: "notifications.tabs.archived",
    status: "archived"
  }
] as const;
