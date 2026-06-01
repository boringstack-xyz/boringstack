import { and, eq } from "drizzle-orm";
import { db } from "../../clients/postgres";
import { pushSubscription } from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";
import { now } from "../../lib/time/now";
import { PUSH_SUBSCRIPTIONS_MAX_PER_USER } from "./notifications.push.constants";
import type {
  IPublicPushSubscription,
  ISubscribePushInput,
  IUnsubscribePushInput,
} from "./notifications.push.types";
import { toPublicPushSubscription } from "./notifications.push.utils";

/**
 * Write-side service for the user's Web Push subscriptions. The
 * `notifications` UI calls `subscribe()` after `PushManager.subscribe()`
 * succeeds in the browser; the worker reads the rows at delivery time.
 *
 * Upsert semantics on (user, endpoint) keep the row count bounded even
 * when a browser re-subscribes after permission flips. The hard cap of
 * `PUSH_SUBSCRIPTIONS_MAX_PER_USER` is a soft anti-abuse guard — exceeding
 * it returns 409 instead of silently dropping.
 */
export class NotificationsPushService {
  async subscribe(
    input: ISubscribePushInput
  ): Promise<IPublicPushSubscription> {
    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(pushSubscription)
        .where(
          and(
            eq(pushSubscription.userId, input.userId),
            eq(pushSubscription.endpoint, input.endpoint)
          )
        );

      const found = existing[0];
      const nowIso = now();

      if (found !== undefined) {
        const [updated] = await tx
          .update(pushSubscription)
          .set({
            p256dhKey: input.p256dhKey,
            authKey: input.authKey,
            expiresAt: input.expiresAt,
            userAgent: input.userAgent,
            lastUsedAt: nowIso,
          })
          .where(eq(pushSubscription.id, found.id))
          .returning();

        if (updated === undefined) {
          throw ApiErrors.internal("Failed to refresh push subscription");
        }

        return toPublicPushSubscription(updated);
      }

      const userTotal = await tx.$count(
        pushSubscription,
        eq(pushSubscription.userId, input.userId)
      );

      if (userTotal >= PUSH_SUBSCRIPTIONS_MAX_PER_USER) {
        throw ApiErrors.conflict(
          "Too many push subscriptions for this user. Remove an older device before adding a new one."
        );
      }

      const [created] = await tx
        .insert(pushSubscription)
        .values({
          userId: input.userId,
          endpoint: input.endpoint,
          p256dhKey: input.p256dhKey,
          authKey: input.authKey,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent,
        })
        .returning();

      if (created === undefined) {
        throw ApiErrors.internal("Failed to insert push subscription");
      }

      void auditLogService.record({
        userId: input.userId,
        action: AUDIT_ACTIONS.NOTIFICATION_PUSH_SUBSCRIBED,
        metadata: { subscriptionId: created.id },
      });

      return toPublicPushSubscription(created);
    });
  }

  async unsubscribe(
    input: IUnsubscribePushInput
  ): Promise<{ removed: number }> {
    const deleted = await db
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, input.userId),
          eq(pushSubscription.endpoint, input.endpoint)
        )
      )
      .returning({ id: pushSubscription.id });

    if (deleted.length > 0) {
      void auditLogService.record({
        userId: input.userId,
        action: AUDIT_ACTIONS.NOTIFICATION_PUSH_UNSUBSCRIBED,
        metadata: { removed: deleted.length },
      });
    }

    return { removed: deleted.length };
  }

  async listForUser(userId: string): Promise<IPublicPushSubscription[]> {
    const rows = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId))
      .orderBy(pushSubscription.createdAt);

    return rows.map(toPublicPushSubscription);
  }
}

export const notificationsPushService = new NotificationsPushService();
