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
  });
