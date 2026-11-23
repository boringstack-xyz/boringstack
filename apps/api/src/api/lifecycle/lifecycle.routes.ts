import { Elysia } from "elysia";

import { env } from "../../config/env";
import { errorHandler } from "../../middleware/error-handler";
import { UnsubscribeQuery } from "./lifecycle.schemas";
import { lifecycleService } from "./lifecycle.service";
import { unsubscribePage, unsubscribeUrl } from "./lifecycle.utils";

const TAG = "Lifecycle";

const html = (body: string): Response =>
  new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });

/*
 * Public: the unsubscribe link in follow-up emails works without a login.
 * The signed token names the person. GET only shows the page; POST acts,
 * which is also what mail apps call for one-click List-Unsubscribe (RFC 8058).
 */
const lifecycleRoutes = new Elysia()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/unsubscribe",
    ({ query }) =>
      html(
        unsubscribePage({
          state: "confirm",
          actionUrl: unsubscribeUrl(env.PUBLIC_API_URL, query.token),
          appUrl: env.FRONTEND_URL,
        })
      ),
    {
      query: UnsubscribeQuery,
      detail: {
        tags: [TAG],
        summary: "Show the follow-up email unsubscribe page",
      },
    }
  )
  .post(
    "/unsubscribe",
    async ({ query }) => {
      const done = await lifecycleService.unsubscribe(query.token);

      return html(
        unsubscribePage({
          state: done ? "done" : "invalid",
          actionUrl: unsubscribeUrl(env.PUBLIC_API_URL, query.token),
          appUrl: env.FRONTEND_URL,
        })
      );
    },
    {
      query: UnsubscribeQuery,
      parse: "none",
      detail: {
        tags: [TAG],
        summary: "Unsubscribe from follow-up emails (one-click capable)",
      },
    }
  );

export default lifecycleRoutes;
