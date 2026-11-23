import { lt } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { productEvents } from "../../clients/postgres/schema";
import { logger } from "../../config/logger";
import { isSyntheticEmail } from "../../lib/synthetic";
import { now, nowMs } from "../../lib/time/now";
import { PRODUCT_EVENT_RETENTION_DAYS } from "./product-events.constants";
import type { IProductEventInput } from "./product-events.types";

const DAY_MS = 24 * 60 * 60 * 1000;

class ProductEventsService {
  /*
   * One event for the caller's account. The verification robot's accounts
   * record nothing, so its journeys never count as product usage.
   */
  async record(input: IProductEventInput): Promise<void> {
    if (isSyntheticEmail(input.email)) {
      return;
    }

    const timestamp = now();

    await db.insert(productEvents).values({
      accountId: input.accountId,
      userId: input.userId,
      kind: input.kind,
      context: input.context,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  /* Deletes events older than the retention window. Returns rows removed. */
  async pruneExpired(): Promise<number> {
    const cutoff = new Date(
      nowMs() - PRODUCT_EVENT_RETENTION_DAYS * DAY_MS
    ).toISOString();
    const deleted = await db
      .delete(productEvents)
      .where(lt(productEvents.createdAt, cutoff))
      .returning({ id: productEvents.id });

    if (deleted.length > 0) {
      logger.info("Pruned expired product events", {
        event: "product_events.pruned",
        count: deleted.length,
        retentionDays: PRODUCT_EVENT_RETENTION_DAYS,
      });
    }

    return deleted.length;
  }
}

export const productEventsService = new ProductEventsService();
