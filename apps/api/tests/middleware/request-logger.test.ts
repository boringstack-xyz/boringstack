import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";

import { requestLogger } from "../../src/middleware/request-logger";

/*
 * Invariant: every response carries `x-request-id` set by the
 * middleware's `onAfterHandle` hook. A future `.use()` reorder or
 * scope downgrade that strips the hook is caught here.
 */
const TEST_PATH = "/test-ping";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const buildApp = () =>
  new Elysia().use(requestLogger).get(TEST_PATH, () => ({ ok: true }), {
    detail: { tags: ["test"] },
    response: t.Object({ ok: t.Boolean() }),
  });

describe("requestLogger sets x-request-id on every response", () => {
  test("response carries an x-request-id header in UUID form", async () => {
    const app = buildApp();
    const response = await app.handle(
      new Request(`http://localhost${TEST_PATH}`, { method: "GET" })
    );

    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
  });

  test("each request gets a distinct id", async () => {
    const app = buildApp();
    const a = await app.handle(
      new Request(`http://localhost${TEST_PATH}`, { method: "GET" })
    );
    const b = await app.handle(
      new Request(`http://localhost${TEST_PATH}`, { method: "GET" })
    );

    const idA = a.headers.get("x-request-id");
    const idB = b.headers.get("x-request-id");

    expect(idA).toMatch(UUID_PATTERN);
    expect(idB).toMatch(UUID_PATTERN);
    expect(idA).not.toBe(idB);
  });
});
