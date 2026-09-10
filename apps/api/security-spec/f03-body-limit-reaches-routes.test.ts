/**
 * F03: the configured request-body cap is ineffective.
 *
 * `src/middleware/body-limit.ts:62` is `new Elysia().onParse(...)` with no
 * `{ as: "global" }`. Elysia defaults lifecycle hooks to `local`, which covers
 * the declaring instance and its descendants but NOT routes registered on the
 * parent that `use`d it. `src/config/app/app.ts:45` does exactly that:
 *
 *   let configured = app.use(bodyLimit).use(requestLogger).use(metricsObserver);
 *
 * and then registers every route group on `configured`. So the hook never
 * runs for any real route.
 *
 * There is no enforcement anywhere else either: `src/index.ts:64` is a bare
 * `createApp().listen(env.PORT)` with no `maxRequestBodySize`, and the
 * production Traefik labels attach only security-headers, compress and
 * ratelimit, no buffering middleware.
 *
 * Why the existing test does not catch it
 * ---------------------------------------
 * `tests/middleware/body-limit.test.ts:88` sends `"ignored — the cap fires
 * before parse"` with `content-type: application/json`. That is not valid
 * JSON, so Elysia's parser rejects it with `code: "PARSE"` → 400, and the
 * assertion only checks `status === 400` plus the presence of an `error` key.
 * The cap never fires and the test passes anyway. Sending a *valid* body of
 * the same advertised size returns 200.
 *
 * So this test uses a valid JSON body and asserts on 413 specifically, not on
 * "some 4xx".
 */
import { describe, expect, test } from "bun:test";

import { createApp } from "../src/config/app/app";
import { MAX_BODY_SIZE_BYTES } from "../src/middleware/body-limit";

/*
 * A real route on the real composition. `/api/v1/auth/login` is a POST that
 * exists, is unauthenticated, and parses a JSON body: the cap must reject
 * the request before any of that matters.
 */
const ROUTE = "http://localhost/api/v1/auth/login";

const jsonOfSize = (bytes: number): string => {
  const envelope = JSON.stringify({ email: "a@b.co", password: "" });
  const padding = bytes - envelope.length;

  return JSON.stringify({
    email: "a@b.co",
    password: "x".repeat(Math.max(padding, 1)),
  });
};

describe("F03 body limit reaches real routes", () => {
  test("a valid over-cap body is rejected with 413", async () => {
    const app = createApp();
    const payload = jsonOfSize(MAX_BODY_SIZE_BYTES + 1);

    const res = await app.handle(
      new Request(ROUTE, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(payload.length),
        },
        body: payload,
      })
    );

    /*
     * 413, not "any 4xx". A 400 here means the JSON parser rejected it, which
     * is the false pass the existing test relies on. A 401/422 means the
     * request reached the handler, i.e. the cap did not fire.
     */
    expect(res.status).toBe(413);
  });

  test("an absurd Content-Length is rejected before the handler", async () => {
    const app = createApp();

    const res = await app.handle(
      new Request(ROUTE, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "99999999",
        },
        body: JSON.stringify({ email: "a@b.co", password: "hunter2" }),
      })
    );

    expect(res.status).toBe(413);
  });

  test("control: a normal body still reaches the route", async () => {
    const app = createApp();
    const payload = JSON.stringify({ email: "a@b.co", password: "hunter2" });

    const res = await app.handle(
      new Request(ROUTE, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(payload.length),
        },
        body: payload,
      })
    );

    // Whatever the auth outcome, it must not be a size rejection.
    expect(res.status).not.toBe(413);
  });
});
