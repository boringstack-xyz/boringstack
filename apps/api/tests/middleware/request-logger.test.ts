import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";

import { ApiErrors } from "../../src/lib/errors";
import { errorHandler } from "../../src/middleware/error-handler";
import { requestLogger } from "../../src/middleware/request-logger";

/*
 * Invariant: every response carries `x-request-id`, including error
 * paths (validation, 404, ApiError throws). Elysia's `onAfterHandle`
 * only fires on successful returns — without an equivalent on the
 * error path the UI sees `x-request-id: null` for the exact responses
 * support tickets pivot on.
 */
const TEST_PATH = "/test-ping";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const TEST_TAGS = ["test"] as const;
const REQUEST_ID_HEADER = "x-request-id";

const buildApp = () =>
  new Elysia()
    .use(requestLogger)
    .onError(({ code, error, set }) =>
      errorHandler({ code: String(code), error, set })
    )
    .get(TEST_PATH, () => ({ ok: true }), {
      detail: { tags: [...TEST_TAGS] },
      response: t.Object({ ok: t.Boolean() }),
    })
    .get(
      "/throw-api-error",
      () => {
        throw ApiErrors.forbidden("nope");
      },
      {
        detail: { tags: [...TEST_TAGS] },
        response: t.Object({ ok: t.Boolean() }),
      }
    )
    .post("/needs-body", ({ body }) => ({ ok: typeof body === "object" }), {
      body: t.Object({ requiredField: t.String() }),
      response: t.Object({ ok: t.Boolean() }),
      detail: { tags: [...TEST_TAGS] },
    });

describe("requestLogger sets x-request-id on every response", () => {
  test("response carries an x-request-id header in UUID form", async () => {
    const app = buildApp();
    const response = await app.handle(
      new Request(`http://localhost${TEST_PATH}`, { method: "GET" })
    );

    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(UUID_PATTERN);
  });

  test("each request gets a distinct id", async () => {
    const app = buildApp();
    const a = await app.handle(
      new Request(`http://localhost${TEST_PATH}`, { method: "GET" })
    );
    const b = await app.handle(
      new Request(`http://localhost${TEST_PATH}`, { method: "GET" })
    );

    const idA = a.headers.get(REQUEST_ID_HEADER);
    const idB = b.headers.get(REQUEST_ID_HEADER);

    expect(idA).toMatch(UUID_PATTERN);
    expect(idB).toMatch(UUID_PATTERN);
    expect(idA).not.toBe(idB);
  });

  test("x-request-id is present when the handler throws an ApiError", async () => {
    const app = buildApp();
    const response = await app.handle(
      new Request("http://localhost/throw-api-error", { method: "GET" })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(UUID_PATTERN);
  });

  test("x-request-id is present on a 404 (unknown route)", async () => {
    const app = buildApp();
    const response = await app.handle(
      new Request("http://localhost/no-such-route", { method: "GET" })
    );

    expect(response.status).toBe(404);
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(UUID_PATTERN);
  });

  test("x-request-id is present on a TypeBox VALIDATION error", async () => {
    const app = buildApp();
    const response = await app.handle(
      new Request("http://localhost/needs-body", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wrongShape: true }),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(UUID_PATTERN);
  });
});
