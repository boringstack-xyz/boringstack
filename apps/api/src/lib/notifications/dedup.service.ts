import { now, nowMs } from "../time/now";
import { lt, lte } from "drizzle-orm";
import { db } from "../../clients/postgres";
import { notificationDedup } from "../../clients/postgres/schema";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";

/**
 * Dedup ledger driver. The worker calls `tryClaim(...)` before persisting a
 * notification. The unique constraint on `dedup_key` does the work: an
 * inserted row means the event is fresh; a collision means an equivalent
 * event has already fired inside the configured window and the current
 * dispatch must be skipped.
 *
 * Errors are surfaced (not swallowed) — a flaky dedup table would otherwise
 * be invisible and let duplicates through silently. The worker decides how
 * to react (BullMQ's retry envelope wraps it).
 */
export class DedupService {
  /**
   * Returns `true` when the dedup row was newly inserted (caller should
   * dispatch), `false` when an existing row collided (caller should skip).
   */
  async tryClaim(input: {
    dedupKey: string;
    windowSeconds: number;
  }): Promise<boolean> {
    const nowIso = now();
    const expiresAt = new Date(
      nowMs() + input.windowSeconds * 1000
    ).toISOString();

    const inserted = await db
      .insert(notificationDedup)
      .values({
        dedupKey: input.dedupKey,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: notificationDedup.dedupKey,
        set: { expiresAt },
        setWhere: lte(notificationDedup.expiresAt, nowIso),
      })
      .returning({ id: notificationDedup.id });

    return inserted.length > 0;
  }

  /**
   * Removes expired dedup rows. Called by a repeatable BullMQ job in Phase 6
   * so the table stays small. Returns the number of rows deleted for
   * observability.
   */
  async purgeExpired(): Promise<number> {
    try {
      const nowIso = now();
      const deleted = await db
        .delete(notificationDedup)
        .where(lt(notificationDedup.expiresAt, nowIso))
        .returning({ id: notificationDedup.id });

      return deleted.length;
    } catch (error: unknown) {
      logger.error("Notification dedup purge failed", {
        event: "notifications.dedup.purge_failed",
        error: getErrorMessage(error),
      });

      return 0;
    }
  }
}

export const dedupService = new DedupService();
