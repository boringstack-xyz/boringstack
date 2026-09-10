import { describe, expect, test } from "bun:test";

import { notificationsStreamHandler } from "../../../src/api/notifications/notifications.sse";
import { env } from "../../../src/config/env";
import { ApiError } from "../../../src/lib/errors/api-error";

interface ISseTestCtx {
  user: { id: string };
  credential: {
    jti: string | null;
    issuedAt: number | null;
    expiresAt: number | null;
  };
  set: { headers: Record<string, string | number> };
  request: Request;
}

const makeCtx = (): ISseTestCtx => ({
  user: { id: "u-1" },
  /*
   * A live credential. The stream re-checks expiry and revocation on every
   * tick, so it needs the token's own `jti`, `iat` and `exp` rather than
   * just a user id.
   */
  credential: {
    jti: "jti-1",
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 900,
  },
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
