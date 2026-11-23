import { Elysia } from "elysia";

import { adminRequestGuard } from "../../middleware/admin-request-guard";
import { bodyLimit } from "../../middleware/body-limit";
import { errorHandler } from "../../middleware/error-handler";
import { requestLogger } from "../../middleware/request-logger";
import { env } from "../env";
import { routes } from "../routes";
import { swaggerConfig } from "../swagger";

/**
 * The LAN-only operator admin API. No CORS, no rate limit, no auth cookie:
 * it is reachable only inside the cluster network and acts as the operator
 * resolved at boot. Writes must come from the dashboard
 * (`adminRequestGuard`), so a page on another site cannot drive them
 * through the operator's browser. Only health and the admin routes are
 * mounted; there is no /metrics here.
 */
export const createAdminApp = () => {
  const app = new Elysia();

  if (env.isDevelopment) {
    app.use(swaggerConfig);
  }

  app.onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  );

  return app
    .use(bodyLimit)
    .use(adminRequestGuard)
    .use(requestLogger)
    .use(routes.health)
    .group("/api/v1/admin", (group) => group.use(routes.admin));
};
