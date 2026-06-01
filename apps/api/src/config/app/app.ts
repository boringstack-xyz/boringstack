import { Elysia } from "elysia";
import { AUTH_COOKIE_NAME } from "../../lib/cookies";
import { bodyLimit } from "../../middleware/body-limit";
import { errorHandler } from "../../middleware/error-handler";
import { metricsObserver } from "../../middleware/metrics-observer";
import { requestLogger } from "../../middleware/request-logger";
import { env } from "../env";
import { routes } from "../routes";
import { buildCors, buildRateLimit } from "../security";
import { swaggerConfig } from "../swagger";

export const createApp = () => {
  const app = new Elysia({
    cookie: {
      secrets: env.JWT_SECRET,
      sign: [AUTH_COOKIE_NAME],
    },
  });

  if (env.isDevelopment) {
    app.use(swaggerConfig);
  }

  /*
   * Security headers (CSP, HSTS, X-Frame-Options, etc.) are set by Traefik in
   * front of this service, not here. The api container is meant to run behind
   * a Traefik instance — running it standalone leaves it without those headers.
   * See infra/compose/compose/docker-compose.production-labels.yml.
   */
  /*
   * App-level catch-all error handler. Route-level `.onError` covers
   * thrown errors INSIDE a matched route, but Elysia's NOT_FOUND for
   * an unmatched path (or method mismatch) never reaches a route — so
   * without this handler the client got a plain-text Elysia default
   * response instead of the canonical JSON envelope. With it, every
   * unknown route also returns `{ success: false, error: { code,
   * message, timestamp } }`, identical to handler errors.
   */
  app.onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  );

  const cors = buildCors();

  let configured = app.use(bodyLimit).use(requestLogger).use(metricsObserver);

  if (cors !== undefined) {
    configured = configured.use(cors);
  }

  return (
    configured
      .use(buildRateLimit())
      /*
       * Health probes + Prometheus metrics mounted at root (no /api/v1
       * prefix) so orchestrators and the scrape pipeline hit the
       * conventional URLs.
       */
      .use(routes.health)
      .use(routes.metrics)
      .group("/api/v1/capabilities", (group) => group.use(routes.capabilities))
      .group("/api/v1/auth", (group) => group.use(routes.auth))
      .group("/api/v1/users", (group) => group.use(routes.users))
      .group("/api/v1/billing", (group) => group.use(routes.billing))
      .group("/api/v1/admin", (group) => group.use(routes.admin))
      .group("/api/v1/dashboard", (group) => group.use(routes.dashboard))
      .group("/api/v1/notifications", (group) =>
        group.use(routes.notifications)
      )
      .group("/api/v1/webhooks", (group) => group.use(routes.webhooks))
      .group("/api/v1/accounts", (group) =>
        group.use(routes.accountSession).use(routes.accounts)
      )
      .group("/api/v1/invitations", (group) => group.use(routes.invitations))
  );
};
