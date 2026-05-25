import { createAuthMiddleware } from "../auth/auth.plugin";
import { errorHandler } from "../../middleware/error-handler";
import {
  ActivityPageSchema,
  ActivityQuerySchema,
  DashboardSummarySchema,
} from "./dashboard.schemas";
import { dashboardService } from "./dashboard.service";
import { parseDashboardLimit } from "./dashboard.utils";

const dashboardRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get("/summary", async ({ user }) => dashboardService.getSummary(user.id), {
    response: DashboardSummarySchema,
    detail: {
      tags: ["Dashboard"],
      summary: "Dashboard summary stats (per user)",
      security: [{ cookieAuth: [] }],
    },
  })
  .get(
    "/activity",
    async ({ user, query }) =>
      dashboardService.getActivity(
        user.id,
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
