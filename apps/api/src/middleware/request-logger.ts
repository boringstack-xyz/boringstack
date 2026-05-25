import { Elysia } from "elysia";
import { logger } from "../config/logger";
import { redactSensitiveInfo } from "./request-logger.utils";

export const requestLogger = new Elysia()
  .derive(({ request }) => {
    const startTime = Date.now();
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
  .onAfterHandle(({ set, requestId }) => {
    if (typeof requestId === "string") {
      set.headers["x-request-id"] = requestId;
    }
  });
