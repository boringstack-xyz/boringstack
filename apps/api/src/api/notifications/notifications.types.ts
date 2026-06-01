import type { InferSelectModel } from "drizzle-orm";
import type { notification } from "../../clients/postgres/schema";

export type INotificationRow = InferSelectModel<typeof notification>;

export type NotificationStatus = "unread" | "read" | "archived";

/**
 * Shape returned to the UI: pre-rendered strings + identification + status.
 * Payload is omitted on purpose — the UI consumes `rendered` not `payload`,
 * and exposing the raw payload would leak internal event-shape details.
 */
export interface IPublicNotification {
  id: string;
  eventType: string;
  title: string;
  body: string;
  ctaUrl: string | null;
  ctaLabel: string | null;
  status: NotificationStatus;
  readAt: string | null;
  createdAt: string;
}

export interface INotificationListPage {
  items: IPublicNotification[];
  nextCursor: string | null;
}
