import { db } from "../../clients/postgres";
import { adminFeedItemStates } from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";
import { now, nowMs } from "../../lib/time/now";

import { adminService } from "./admin.service";
import type {
  IAdminFeedItem,
  IAdminFeedItemState,
  IFeedItemDraft,
  IQueueStatsReader,
} from "./admin-feed.types";
import {
  FEED_QUEUE_FAILED_PREFIX,
  HOUR_MS,
  isFeedItemVisible,
  isValidSnoozeHours,
  FEED_MAX_SNOOZE_HOURS,
} from "./admin-feed.utils";

/**
 * The operator action feed: items that need a person to look. Today that is
 * every queue with failed jobs. Each item has a stable key, so resolve and
 * snooze state survive restarts and an item re-appears only when it should.
 */
export class AdminFeedService {
  constructor(
    private readonly readQueueStats: IQueueStatsReader = () =>
      adminService.getQueueStats()
  ) {}

  async list(): Promise<IAdminFeedItem[]> {
    const drafts = await this.drafts();
    const states = await this.states();
    const nowEpochMs = nowMs();

    return drafts.filter((item) =>
      isFeedItemVisible(item, states.get(item.key), nowEpochMs)
    );
  }

  async resolve(key: string, operatorUserId: string): Promise<void> {
    const current = await this.currentCount(key);

    await this.upsert({
      key,
      state: "resolved",
      observedCount: current,
      snoozedUntil: null,
      operatorUserId,
    });

    void auditLogService.record({
      userId: operatorUserId,
      action: AUDIT_ACTIONS.ADMIN_FEED_ITEM_RESOLVED,
      resource: `feed:${key}`,
      metadata: { itemKey: key, observedCount: current },
    });
  }

  async snooze(
    key: string,
    hours: number,
    operatorUserId: string
  ): Promise<string> {
    if (!isValidSnoozeHours(hours)) {
      throw ApiErrors.invalidInput(
        `Snooze must be 1 to ${String(FEED_MAX_SNOOZE_HOURS)} hours`,
        "hours"
      );
    }

    const until = new Date(nowMs() + hours * HOUR_MS).toISOString();

    await this.upsert({
      key,
      state: "snoozed",
      observedCount: 0,
      snoozedUntil: until,
      operatorUserId,
    });

    void auditLogService.record({
      userId: operatorUserId,
      action: AUDIT_ACTIONS.ADMIN_FEED_ITEM_SNOOZED,
      resource: `feed:${key}`,
      metadata: { itemKey: key, hours },
    });

    return until;
  }

  private async drafts(): Promise<IFeedItemDraft[]> {
    const queues = await this.readQueueStats();

    return queues
      .filter((queue) => queue.counts.failed > 0)
      .map((queue) => ({
        key: `${FEED_QUEUE_FAILED_PREFIX}${queue.name}`,
        title: `Failed jobs in ${queue.name}`,
        count: queue.counts.failed,
      }));
  }

  private async currentCount(key: string): Promise<number> {
    const drafts = await this.drafts();
    const item = drafts.find((draft) => draft.key === key);

    return item?.count ?? 0;
  }

  private async states(): Promise<Map<string, IAdminFeedItemState>> {
    const rows = await db.select().from(adminFeedItemStates);

    return new Map(
      rows.map((row) => [
        row.itemKey,
        {
          state: row.state,
          observedCount: row.observedCount,
          snoozedUntil: row.snoozedUntil,
        },
      ])
    );
  }

  private async upsert(input: {
    key: string;
    state: "resolved" | "snoozed";
    observedCount: number;
    snoozedUntil: string | null;
    operatorUserId: string;
  }): Promise<void> {
    await db
      .insert(adminFeedItemStates)
      .values({
        itemKey: input.key,
        state: input.state,
        observedCount: input.observedCount,
        snoozedUntil: input.snoozedUntil,
        actorUserId: input.operatorUserId,
      })
      .onConflictDoUpdate({
        target: adminFeedItemStates.itemKey,
        set: {
          state: input.state,
          observedCount: input.observedCount,
          snoozedUntil: input.snoozedUntil,
          actorUserId: input.operatorUserId,
          updatedAt: now(),
        },
      });
  }
}

export const adminFeedService = new AdminFeedService();
