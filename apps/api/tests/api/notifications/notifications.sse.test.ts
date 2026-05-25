import { describe, expect, test } from "bun:test";

import { notificationsStreamHandler } from "../../../src/api/notifications/notifications.sse";
import { env } from "../../../src/config/env";
import { ApiError } from "../../../src/lib/errors/api-error";

interface ISseTestCtx {
  user: { id: string };
  set: { headers: Record<string, string | number> };
  request: Request;
}

const makeCtx = (): ISseTestCtx => ({
  user: { id: "u-1" },
  set: { headers: {} },
  request: new Request("http://localhost/sse"),
});

describe("notificationsStreamHandler", () => {
  test("throws notFound when NOTIFICATIONS_SSE_ENABLED is false (test default)", async () => {
    expect(env.NOTIFICATIONS_SSE_ENABLED).toBe(false);

    const gen = notificationsStreamHandler(makeCtx());

    let captured: unknown;

    try {
      await gen.next();
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });

  test("throws an ApiError 404 when SSE is disabled", async () => {
    expect(env.NOTIFICATIONS_SSE_ENABLED).toBe(false);

    const gen = notificationsStreamHandler(makeCtx());

    let captured: unknown;

    try {
      await gen.next();
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(ApiError);

    if (captured instanceof ApiError) {
      expect(captured.statusCode).toBe(404);
    }
  });
});
