import { buildScopedRateLimit } from "../../config/security";
import { errorHandler } from "../../middleware/error-handler";
import { requireAuth } from "../auth/auth.plugin";
import { PRODUCT_EVENT_RATE_LIMIT } from "./product-events.constants";
import { ProductEventBodySchema } from "./product-events.schemas";
import { productEventsService } from "./product-events.service";

const TAG = "Product events";

/*
 * First-party usage the database cannot derive. The app sends these only when
 * the person accepted analytics.
 */
const productEventsRoutes = requireAuth()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .use(buildScopedRateLimit("product-event", PRODUCT_EVENT_RATE_LIMIT))
  .post(
    "/",
    async ({ user, accountId, body, set }) => {
      await productEventsService.record({
        accountId,
        userId: user.id,
        email: user.email,
        kind: body.kind,
        context: body.context ?? "",
      });
      set.status = 204;

      return null;
    },
    {
      body: ProductEventBodySchema,
      detail: {
        tags: [TAG],
        summary: "Record a consented product event",
        security: [{ cookieAuth: [] }],
      },
    }
  );

export default productEventsRoutes;
