import { now } from "../../lib/time/now";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "../../clients/postgres";
import { notification } from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";
import { NOTIFICATION_STATUS } from "../../lib/notifications";
import {
  NOTIFICATIONS_DEFAULT_LIMIT,
  NOTIFICATIONS_MAX_LIMIT,
} from "./notifications.constants";
import type {
  INotificationListPage,
  IPublicNotification,
} from "./notifications.types";
import { toPublicNotification } from "./notifications.utils";

/**
 * Read-side service for the UI. Mutations (`status` flips, `mark-all-read`)
 * record audit entries because they change user-visible state. Heavy
 * dispatching logic lives in `lib/notifications/`; this service intentionally
 * stays small.
 */
export class NotificationsService {
  async list(input: {
    userId: string;
    status?: "unread" | "read" | "archived";
    limit: number;
    cursor?: string;
  }): Promise<INotificationListPage> {
    const cappedLimit = Math.min(
      Math.max(input.limit, 1),
      NOTIFICATIONS_MAX_LIMIT
    );

    const filters = [eq(notification.recipientUserId, input.userId)];

    if (input.status !== undefined) {
      filters.push(eq(notification.status, input.status));
    }

    if (input.cursor !== undefined && input.cursor !== "") {
      const cursorId = input.cursor.replace(/^cursor:/, "");
      const cursorRow = await db.query.notification.findFirst({
        where: and(
          eq(notification.id, cursorId),
          eq(notification.recipientUserId, input.userId)
        ),
      });

      if (!cursorRow) {
        throw ApiErrors.invalidInput("Invalid notification cursor", "cursor");
      }

      const cursorFilter = or(
        lt(notification.createdAt, cursorRow.createdAt),
        and(
          eq(notification.createdAt, cursorRow.createdAt),
          lt(notification.id, cursorRow.id)
        )
      );

      if (cursorFilter !== undefined) {
        filters.push(cursorFilter);
      }
    }

    const rows = await db
      .select()
      .from(notification)
      .where(and(...filters))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(cappedLimit + 1);

    const items = rows.slice(0, cappedLimit).map(toPublicNotification);
    const last = items.at(-1);
    const nextCursor =
      rows.length > cappedLimit && last !== undefined
        ? `cursor:${last.id}`
        : null;

    return { items, nextCursor };
  }

  async updateStatus(input: {
    userId: string;
    notificationId: string;
    status: "read" | "archived";
  }): Promise<IPublicNotification> {
    const nowIso = now();
    const [updated] = await db
      .update(notification)
      .set({
        status: input.status,
        readAt: input.status === "read" ? nowIso : null,
      })
      .where(
        and(
          eq(notification.id, input.notificationId),
          eq(notification.recipientUserId, input.userId)
        )
      )
      .returning();

    if (!updated) {
      throw ApiErrors.notFound("Notification");
    }

    void auditLogService.record({
      userId: input.userId,
      action: AUDIT_ACTIONS.NOTIFICATION_STATUS_UPDATED,
      resource: `notification:${input.notificationId}`,
      metadata: { status: input.status },
    });

    return toPublicNotification(updated);
  }

  async markAllRead(input: { userId: string }): Promise<{ updated: number }> {
    const nowIso = now();
    const updatedRows = await db
      .update(notification)
      .set({ status: NOTIFICATION_STATUS.READ, readAt: nowIso })
      .where(
        and(
          eq(notification.recipientUserId, input.userId),
          eq(notification.status, NOTIFICATION_STATUS.UNREAD)
        )
      )
      .returning({ id: notification.id });

    if (updatedRows.length > 0) {
      void auditLogService.record({
        userId: input.userId,
        action: AUDIT_ACTIONS.NOTIFICATION_MARK_ALL_READ,
        metadata: { count: updatedRows.length },
      });
    }

    return { updated: updatedRows.length };
  }

  static defaultLimit(): number {
    return NOTIFICATIONS_DEFAULT_LIMIT;
  }
}

export const notificationsService = new NotificationsService();
