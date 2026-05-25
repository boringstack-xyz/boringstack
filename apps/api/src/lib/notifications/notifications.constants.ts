/**
 * Canonical channel names. Channels register themselves into the
 * `ChannelRegistry` under one of these keys at boot.
 */
export const NOTIFICATION_CHANNELS = {
  IN_APP: "in-app",
  EMAIL: "email",
  SSE: "sse",
  WEB_PUSH: "web-push",
} as const;

/**
 * `notification.status` lifecycle. `unread` on insert; `read` when the user
 * marks it (single or bulk); `archived` when the user dismisses it from the
 * primary feed without deletion.
 */
export const NOTIFICATION_STATUS = {
  UNREAD: "unread",
  READ: "read",
  ARCHIVED: "archived",
} as const;

/**
 * `notification_delivery.status` lifecycle. `pending` on insert; channels
 * transition to `sent` when delivery succeeds, `failed` on terminal error,
 * `suppressed` when user preferences disable the channel for this event
 * (still recorded for auditability).
 */
export const DELIVERY_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SUPPRESSED: "suppressed",
} as const;
