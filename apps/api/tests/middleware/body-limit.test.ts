import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";

import {
  MAX_BODY_SIZE_BYTES,
  bodyLimit,
  enforceBodyLimit,
} from "../../src/middleware/body-limit";
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

const ECHO_URL = "http://localhost/echo";

describe("enforceBodyLimit — pure guard", () => {
  test("passes through unbodied methods regardless of Content-Length", () => {
    expect(() => {
      enforceBodyLimit({ method: "GET", contentLength: null });
    }).not.toThrow();
    expect(() => {
      enforceBodyLimit({ method: "DELETE", contentLength: "999999999" });
    }).not.toThrow();
  });

  test("rejects bodied requests missing Content-Length (closes chunked bypass)", () => {
    expect(() => {
      enforceBodyLimit({ method: "POST", contentLength: null });
    }).toThrow(/Content-Length header is required/);
  });

  test("rejects bodied requests with a non-numeric Content-Length", () => {
    expect(() => {
      enforceBodyLimit({ method: "POST", contentLength: "not-a-number" });
    }).toThrow(/Content-Length header must be a number/);
  });

  test("rejects bodied requests whose Content-Length exceeds 1 MB", () => {
    expect(() => {
      enforceBodyLimit({
        method: "POST",
        contentLength: String(MAX_BODY_SIZE_BYTES + 1),
      });
    }).toThrow(/exceeds 1 MB limit/);
  });

  test("accepts bodied requests whose Content-Length is exactly the cap", () => {
    expect(() => {
      enforceBodyLimit({
        method: "POST",
        contentLength: String(MAX_BODY_SIZE_BYTES),
      });
    }).not.toThrow();
  });

  test("accepts small bodied requests", () => {
    expect(() => {
      enforceBodyLimit({ method: "PATCH", contentLength: "128" });
    }).not.toThrow();
  });
});

describe("bodyLimit middleware — integration", () => {
  test("accepts a small POST", async () => {
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

  test("rejects when Content-Length advertises >1 MB", async () => {
    const app = buildApp();
    const res = await app.handle(
      new Request(ECHO_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(MAX_BODY_SIZE_BYTES + 1),
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

  test("GET requests pass through untouched (no body required)", async () => {
    const app = buildApp().get("/ping", () => ({ ok: true }), {
      response: t.Object({ ok: t.Boolean() }),
    });

    const res = await app.handle(
      new Request("http://localhost/ping", { method: "GET" })
    );

    expect(res.status).toBe(200);
  });
});
