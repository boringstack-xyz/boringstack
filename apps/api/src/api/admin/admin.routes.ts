import { now } from "../../lib/time/now";
import { errorHandler } from "../../middleware/error-handler";
import { requireOperator } from "../../middleware/require-operator";

import { adminAuditService } from "./admin-audit.service";
import {
  AuditFeedQuery,
  AuditFeedResponse,
  QueueStatsListResponse,
} from "./admin.schemas";
import { adminService } from "./admin.service";

/*
 * Mounted only by the LAN-only admin process (src/admin.ts), under
 * /api/v1/admin. Never mounted in the public app: see
 * config/app/app.test.ts.
 */
const adminRoutes = requireOperator()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/queues",
    async () => ({
      queues: await adminService.getQueueStats(),
      timestamp: now(),
    }),
    {
      response: QueueStatsListResponse,
      detail: {
        tags: ["Admin"],
        summary: "Per-queue job counts (read-only, operator only)",
      },
    }
  )
  .get(
    "/audit",
    async ({ query }) => ({
      entries: await adminAuditService.listRecent(query),
      timestamp: now(),
    }),
    {
      query: AuditFeedQuery,
      response: AuditFeedResponse,
      detail: {
        tags: ["Admin"],
        summary: "Recent audit-log entries, newest first (operator only)",
      },
    }
  );

export default adminRoutes;
