import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";

import { bodyLimit } from "../../src/middleware/body-limit";
import { errorHandler } from "../../src/middleware/error-handler";

const buildApp = () =>
  new Elysia()
    .onError(({ code, error, set }) =>
      errorHandler({ code: String(code), error, set })
    )
    .use(bodyLimit)
    .post("/echo", ({ body }) => ({ ok: true, body }), {
      body: t.Unknown(),
      response: t.Object({ ok: t.Boolean(), body: t.Unknown() }),
      detail: { tags: ["Test"] },
    });

const ONE_MB = 1024 * 1024;
const ECHO_URL = "http://localhost/echo";

describe("bodyLimit middleware", () => {
  test("accepts requests under 1 MB", async () => {
    const app = buildApp();
    const payload = JSON.stringify({ data: "x".repeat(1024) });
    const res = await app.handle(
      new Request(ECHO_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(payload.length),
        },
        body: payload,
      })
    );

    expect(res.status).toBe(200);
  });

  test("rejects requests whose Content-Length advertises >1 MB", async () => {
    const app = buildApp();
    const res = await app.handle(
      new Request(ECHO_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(ONE_MB + 1),
        },
        body: "ignored — the cap fires before parse",
      })
    );

    expect(res.status).toBe(400);

    const body: unknown = await res.json();

    if (body === null || typeof body !== "object" || !("error" in body)) {
      throw new Error("expected an error envelope");
    }
  });

  test("passes through requests with no Content-Length header (e.g. chunked)", async () => {
    const app = buildApp();
    const res = await app.handle(
      new Request(ECHO_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("ignores a malformed Content-Length value", async () => {
    const app = buildApp();
    const res = await app.handle(
      new Request(ECHO_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "not-a-number",
        },
        body: JSON.stringify({ ok: true }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("accepts a request whose Content-Length is exactly 1 MB", async () => {
    const app = buildApp();
    const res = await app.handle(
      new Request(ECHO_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(ONE_MB),
        },
        body: "{}",
      })
    );

    expect(res.status).toBe(200);
  });
});
