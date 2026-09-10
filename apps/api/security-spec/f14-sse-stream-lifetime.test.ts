/**
 * F14 — SSE streams outlive authentication.
 *
 * `notifications.sse.ts` authenticates when the connection opens and then
 * loops on `while (!isAborted())` (`:88`), where `isAborted` reflects only
 * the client's abort signal. Nothing re-checks token expiry or revocation,
 * so a stream opened before logout keeps delivering that user's
 * notifications afterwards, for as long as the client holds the socket open.
 *
 * The access token's 15-minute lifetime does not bound this either: the
 * stream never re-reads the token at all.
 *
 * Requires NOTIFICATIONS_SSE_ENABLED=true; the spec lane sets it. With the
 * feature off the route does not exist and the assertion would pass by
 * absence.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { sessionService } from "../src/api/auth/services/session.service";
import { notificationsStreamHandler } from "../src/api/notifications/notifications.sse";
import { createApp } from "../src/config/app/app";
import { jwtRevocationService } from "../src/lib/jwt";
import {
  userNotificationChannel,
  valkeyPubSub,
} from "../src/lib/notifications";
import { cleanDatabase } from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import {
  requireDbOrFail,
  requireValkeyOrFail,
  specPrecondition,
} from "./harness";

const STREAM_USER = "f14-stream@gmail.com";
const PASSWORD = "Hunter2Strong!";
const CLOSE_TIMEOUT_MS = 3_000;

const login = async (
  app: ReturnType<typeof createApp>,
  email: string
): Promise<string> => {
  const res = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  const setCookie = res.headers.getAll("set-cookie").join("; ");

  if (setCookie === "") {
    throw new Error(`f14: login did not issue cookies (status ${res.status})`);
  }

  return setCookie
    .split(/,\s*(?=[^;]+=)/)
    .map((chunk) => chunk.split(";")[0])
    .join("; ");
};

/**
 * Resolves true when the stream ends within the timeout, false if it is still
 * open. Reads with a bounded race so a stream that never closes cannot hang
 * the suite.
 */
const streamClosedWithin = async (
  body: ReadableStream<Uint8Array>,
  timeoutMs: number
): Promise<boolean> => {
  const reader = body.getReader();
  const deadline = Promise.resolve(Bun.sleep(timeoutMs)).then(() => "timeout");

  try {
    for (;;) {
      const outcome = await Promise.race([
        reader.read().then((result) => (result.done ? "closed" : "chunk")),
        deadline,
      ]);

      if (outcome === "closed") {
        return true;
      }

      if (outcome === "timeout") {
        return false;
      }
    }
  } finally {
    await reader.cancel();
  }
};

/** Long enough for a publish to travel through Valkey into the buffer. */
const DELIVERY_MS = 250;

interface IStreamFixture {
  readonly next: () => Promise<IteratorResult<string, void>>;
  readonly publish: (message: string) => Promise<void>;
  readonly credential: {
    jti: string | null;
    issuedAt: number | null;
    expiresAt: number | null;
  };
  readonly close: () => Promise<void>;
}

/**
 * Drives the real generator directly, so a test can suspend it at a `yield`
 * and change the world before asking for the next payload. Going through the
 * HTTP route cannot do that: the response body is drained by the runtime, and
 * the interesting window is the one between two buffered messages.
 */
const openStream = (userId: string, jti: string): IStreamFixture => {
  const controller = new AbortController();
  const credential = {
    jti,
    issuedAt: Math.floor(Date.now() / 1000) - 60,
    expiresAt: Math.floor(Date.now() / 1000) + 3_600,
  };

  const generator = notificationsStreamHandler({
    user: { id: userId },
    credential,
    set: { headers: {} },
    request: new Request("http://localhost/api/v1/notifications/stream", {
      signal: controller.signal,
    }),
  });

  return {
    next: () => generator.next(),
    publish: (message) =>
      valkeyPubSub.publish(userNotificationChannel(userId), message),
    credential,
    close: async () => {
      controller.abort();
      await generator.return();
    },
  };
};

beforeEach(async () => {
  await requireDbOrFail();
  await requireValkeyOrFail();
  await cleanDatabase();
});

describe("F14 SSE stream lifetime", () => {
  test("revoking the session ends an open stream", async () => {
    const { user } = await seedVerifiedUser({ email: STREAM_USER });
    const app = createApp();
    const cookie = await login(app, STREAM_USER);

    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/stream", {
        headers: { cookie, accept: "text/event-stream" },
      })
    );

    expect(res.status).toBe(200);

    if (res.body === null) {
      throw new Error("f14: stream response carried no body");
    }

    // Everything this user holds is revoked while the stream is open.
    await sessionService.revokeAllForUser(user.id);

    /*
     * The stream must notice. Today it loops on the client abort signal
     * alone, so it stays open and keeps delivering until the client
     * disconnects.
     */
    const closed = await streamClosedWithin(res.body, CLOSE_TIMEOUT_MS);

    expect(closed).toBe(true);
  }, 30_000);

  test("an ordinary logout ends an open stream", async () => {
    await seedVerifiedUser({ email: "f14-logout@gmail.com" });
    const app = createApp();
    const cookie = await login(app, "f14-logout@gmail.com");

    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/stream", {
        headers: { cookie, accept: "text/event-stream" },
      })
    );

    expect(res.status).toBe(200);

    if (res.body === null) {
      throw new Error("f14: stream response carried no body");
    }

    /*
     * The real logout route, not `revokeAllForUser`. Logout revokes the
     * single `jti` it was presented with, so a stream that only consults
     * the user-wide revoke cutoff never sees it and keeps delivering to a
     * browser that has signed out.
     */
    const loggedOut = await app.handle(
      new Request("http://localhost/api/v1/auth/logout", {
        method: "POST",
        headers: { cookie },
      })
    );

    specPrecondition(
      loggedOut.status < 400,
      `logout failed with ${loggedOut.status}`
    );

    expect(await streamClosedWithin(res.body, CLOSE_TIMEOUT_MS)).toBe(true);
  }, 30_000);

  test("a revoked credential stops a buffered backlog", async () => {
    const { user } = await seedVerifiedUser({ email: "f14-backlog@gmail.com" });

    /* The route registers the pub/sub wiring this fixture publishes into. */
    createApp();

    const jti = `f14-backlog-${crypto.randomUUID()}`;
    const stream = openStream(user.id, jti);

    try {
      const pending = stream.next();

      // The subscription attaches on the generator's first advance.
      await Bun.sleep(DELIVERY_MS);
      await stream.publish("first");

      const opening = await pending;

      expect(opening.value).toBe("first");

      /*
       * A backlog, not a single message. Every `yield` suspends the
       * generator for as long as the consumer likes, so a check that only
       * runs once the buffer empties is one a publisher can postpone for
       * as long as it keeps publishing.
       */
      for (const message of ["second", "third", "fourth"]) {
        await stream.publish(message);
      }

      await Bun.sleep(DELIVERY_MS);
      await jwtRevocationService.revokeJti(
        jti,
        Math.floor(Date.now() / 1000) + 3_600
      );

      specPrecondition(
        await jwtRevocationService.isJtiRevoked(jti),
        "the jti was not recorded as revoked"
      );

      const after = await stream.next();

      expect(after.done).toBe(true);
      expect(after.value).toBeUndefined();
    } finally {
      await stream.close();
    }
  }, 30_000);

  test("an expiry reached while suspended stops a buffered backlog", async () => {
    const { user } = await seedVerifiedUser({ email: "f14-expiry@gmail.com" });

    createApp();

    const stream = openStream(user.id, `f14-expiry-${crypto.randomUUID()}`);

    try {
      const pending = stream.next();

      await Bun.sleep(DELIVERY_MS);
      await stream.publish("first");

      const opening = await pending;

      expect(opening.value).toBe("first");

      await stream.publish("second");
      await Bun.sleep(DELIVERY_MS);

      /*
       * The token's own `exp` passes while the generator sits at a yield.
       * Nothing else bounds how long this connection may live, so the
       * next payload is the one that must not be delivered.
       */
      stream.credential.expiresAt = Math.floor(Date.now() / 1000) - 1;

      const after = await stream.next();

      expect(after.done).toBe(true);
    } finally {
      await stream.close();
    }
  }, 30_000);

  test("control: a valid credential receives the whole backlog", async () => {
    const { user } = await seedVerifiedUser({ email: "f14-drain@gmail.com" });

    createApp();

    const stream = openStream(user.id, `f14-drain-${crypto.randomUUID()}`);

    try {
      const pending = stream.next();

      await Bun.sleep(DELIVERY_MS);
      await stream.publish("first");

      const opening = await pending;

      expect(opening.value).toBe("first");

      await stream.publish("second");
      await Bun.sleep(DELIVERY_MS);

      /*
       * Load-bearing. A generator that closed on every resume would pass
       * both assertions above while delivering nothing at all.
       */
      const after = await stream.next();

      expect(after.done).toBe(false);
      expect(after.value).toBe("second");
    } finally {
      await stream.close();
    }
  }, 30_000);

  test("control: an authenticated stream opens", async () => {
    await seedVerifiedUser({ email: "f14-open@gmail.com" });
    const app = createApp();
    const cookie = await login(app, "f14-open@gmail.com");

    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/stream", {
        headers: { cookie, accept: "text/event-stream" },
      })
    );

    /*
     * Proves SSE is enabled and the cookie is accepted. Without this, the
     * assertion above could pass simply because the route does not exist.
     */
    expect(res.status).toBe(200);

    await res.body?.cancel();
  }, 30_000);
});
