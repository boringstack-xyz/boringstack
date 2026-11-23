import { apiClient } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import { isAnalyticsGranted, trackEvent } from "./analytics.service";
import type { TProductEventKind } from "./product-events.types";

/*
 * First-party usage the database cannot derive on its own, and the same moment
 * for GA4. Sent only while the visitor accepts analytics; recording never blocks
 * or fails the action it records, so errors are logged and dropped.
 */
export function recordProductEvent(
  kind: TProductEventKind,
  context = ""
): void {
  if (!isAnalyticsGranted()) {
    return;
  }

  trackEvent(kind);

  apiClient
    .POST("/api/v1/product-events/", { body: { kind, context } })
    .catch((error: unknown) => {
      logger.debug({
        event: "product_events.record_failed",
        kind,
        error: getErrorMessage(error)
      });
    });
}
