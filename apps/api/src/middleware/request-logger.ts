import { Elysia } from "elysia";
import { logger } from "../config/logger";
import { redactSensitiveInfo } from "./request-logger.utils";
import { nowMs } from "../lib/time/now";

/*
 * `as: "scoped"` propagates the derive + onAfterHandle hooks to the
 * routes registered on the parent app that does `.use(requestLogger)`.
 * Without it the hooks stay local to this Elysia instance and `x-request-id`
 * is absent from outbound responses.
 */
export const requestLogger = new Elysia({ name: "request-logger" })
  .derive({ as: "scoped" }, ({ request }) => {
    const startTime = nowMs();
    const requestId = crypto.randomUUID();

    const logUrl = redactSensitiveInfo(request.url);

    const reqLogger = logger.child({
      requestId,
      method: request.method,
      url: logUrl,
      userAgent: request.headers.get("user-agent"),
      ip:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        "unknown",
    });

    reqLogger.debug("Request started", { event: "request_start" });

    return {
      requestLogger: reqLogger,
      startTime,
      requestId,
    };
  })
  .onAfterHandle({ as: "scoped" }, ({ set, requestId }) => {
    if (typeof requestId === "string") {
      set.headers["x-request-id"] = requestId;
    }
  })
  /*
   * `onAfterHandle` fires only on a successful handler return; thrown
   * errors skip it and hit `onError`. Without the same header set
   * there, every 4xx/5xx loses `x-request-id` — exactly the responses
   * support pivots on. Mirror the assignment so the header lands
   * regardless of which lifecycle path the response took.
   *
   * Fallback id: NOT_FOUND on an unmatched route fires onError before
   * any scoped `derive` runs, so `requestId` can be undefined. Mint a
   * fresh id in that case — the log and header still correlate, just
   * without the request-start log entry that the normal path emits.
   */
  .onError({ as: "scoped" }, ({ set, requestId }) => {
    const id = typeof requestId === "string" ? requestId : crypto.randomUUID();

    set.headers["x-request-id"] = id;
  });
