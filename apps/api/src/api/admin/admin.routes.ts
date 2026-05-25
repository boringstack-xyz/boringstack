import { now } from "../../lib/time/now";
import { errorHandler } from "../../middleware/error-handler";
import { requirePlatformAdmin } from "../../middleware/require-platform-admin";

import { QueueStatsListResponse } from "./admin.schemas";
import { adminService } from "./admin.service";

const adminRoutes = requirePlatformAdmin()
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
        summary: "Per-queue job counts (admin only)",
        security: [{ cookieAuth: [] }],
      },
    }
  );

export default adminRoutes;
