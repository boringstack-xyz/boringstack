import { now } from "../../time/now";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../clients/postgres";
import { notificationPreference } from "../../../clients/postgres/schema";
import { logger } from "../../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../audit-log";
import { getErrorMessage } from "../../errors";
import type {
  INotificationPreferenceRow,
  IPreferenceResolutionResult,
  IUpdatePreferenceInput,
} from "./preferences.types";

/**
 * Per-user preference store. The dispatcher consults `resolveEnabledChannels`
 * before dispatch; the API consults `listForUser` / `update` for the
 * preferences UI. Missing rows are treated as "enabled" so a fresh user
 * receives every event their event-type defaults declare.
 */
export class NotificationPreferencesService {
  /** All preference rows for a user, ordered by event then channel. */
  async listForUser(userId: string): Promise<INotificationPreferenceRow[]> {
    return db
      .select({
        eventType: notificationPreference.eventType,
        channel: notificationPreference.channel,
        enabled: notificationPreference.enabled,
      })
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, userId));
  }

  /**
   * Upserts a batch of preferences in a single transaction. Used by the
   * preferences UI which submits the user's full settings page at once.
   */
  async update(input: {
    userId: string;
    preferences: readonly IUpdatePreferenceInput[];
  }): Promise<INotificationPreferenceRow[]> {
    if (input.preferences.length === 0) {
      return this.listForUser(input.userId);
    }

    await db.transaction(async (tx) => {
      for (const pref of input.preferences) {
        await tx
          .insert(notificationPreference)
          .values({
            userId: input.userId,
            eventType: pref.eventType,
            channel: pref.channel,
            enabled: pref.enabled,
          })
          .onConflictDoUpdate({
            target: [
              notificationPreference.userId,
              notificationPreference.eventType,
              notificationPreference.channel,
            ],
            set: {
              enabled: pref.enabled,
              updatedAt: now(),
            },
          });
      }
    });

    void auditLogService.record({
      userId: input.userId,
      action: AUDIT_ACTIONS.NOTIFICATION_PREFERENCES_UPDATED,
      metadata: { count: input.preferences.length },
    });

    return this.listForUser(input.userId);
  }

  /**
   * Resolves which of the candidate channels should fire for a given
   * (user, eventType). Channels with an explicit `enabled=false`
   * preference end up in `disabled`; everything else (no row, or
   * `enabled=true`) ends up in `enabled`.
   *
   * Failures are non-fatal: on DB error, every candidate is treated as
   * enabled so notifications still flow — losing a notification because
   * the preferences table is flaky would be strictly worse than ignoring
   * the user's preference for one event.
   */
  async resolveEnabledChannels(input: {
    userId: string;
    eventType: string;
    candidates: readonly string[];
  }): Promise<IPreferenceResolutionResult> {
    if (input.candidates.length === 0) {
      return { enabled: [], disabled: [] };
    }

    try {
      const rows = await db
        .select({
          channel: notificationPreference.channel,
          enabled: notificationPreference.enabled,
        })
        .from(notificationPreference)
        .where(
          and(
            eq(notificationPreference.userId, input.userId),
            eq(notificationPreference.eventType, input.eventType),
            inArray(notificationPreference.channel, [...input.candidates])
          )
        );
      const disabledSet = new Set(
        rows.filter((row) => !row.enabled).map((row) => row.channel)
      );
      const enabled: string[] = [];
      const disabled: string[] = [];

      for (const candidate of input.candidates) {
        if (disabledSet.has(candidate)) {
          disabled.push(candidate);
        } else {
          enabled.push(candidate);
        }
      }

      return { enabled, disabled };
    } catch (error: unknown) {
      logger.error("Notification preference resolution failed", {
        event: "notifications.preferences.resolve_failed",
        userId: input.userId,
        eventType: input.eventType,
        error: getErrorMessage(error),
      });

      return { enabled: input.candidates, disabled: [] };
    }
  }
}

export const notificationPreferencesService =
  new NotificationPreferencesService();
