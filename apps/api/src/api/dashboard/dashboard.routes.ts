import { requireAuth } from "../auth/auth.plugin";
import { errorHandler } from "../../middleware/error-handler";
import {
  ActivityPageSchema,
  ActivityQuerySchema,
  DashboardSummarySchema,
} from "./dashboard.schemas";
import { dashboardService } from "./dashboard.service";
import { parseDashboardLimit } from "./dashboard.utils";

const dashboardRoutes = requireAuth()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/summary",
    async ({ user, accountId }) =>
      dashboardService.getSummary(user.id, accountId),
    {
      response: DashboardSummarySchema,
      detail: {
        tags: ["Dashboard"],
        summary: "Dashboard summary stats (per user)",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/activity",
    async ({ user, accountId, query }) =>
      dashboardService.getActivity(
        user.id,
        accountId,
        parseDashboardLimit(query.limit),
        query.cursor
      ),
    {
      query: ActivityQuerySchema,
      response: ActivityPageSchema,
      detail: {
        tags: ["Dashboard"],
        summary: "Recent activity feed for the current user",
        security: [{ cookieAuth: [] }],
      },
    }
  );

export default dashboardRoutes;
