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

  test("passes through a bodied request with no Content-Length", () => {
    /*
     * A chunked request advertises no length, so there is nothing for a
     * header check to compare. The bound on an unmeasurable body is the
     * server's `maxRequestBodySize` (src/index.ts), which applies while the
     * body streams. Rejecting here instead refused legitimate chunked
     * clients while still letting a lying header through to an unbounded
     * read.
     */
    expect(() => {
      enforceBodyLimit({ method: "POST", contentLength: null });
    }).not.toThrow();
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

  test("rejects a VALID over-cap body with 413", async () => {
    const app = buildApp();

    /*
     * Valid JSON on purpose. An unparseable body asserted against
     * `status === 400` proves nothing: the JSON parser produces that 400 on
     * its own, so the assertion holds whether or not the cap exists. A size
     * rejection has its own status, and this asserts on that.
     */
    const payload = JSON.stringify({ data: "x" });
    const res = await app.handle(
      new Request(ECHO_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(MAX_BODY_SIZE_BYTES + 1),
        },
        body: payload,
      })
    );

    expect(res.status).toBe(413);

    const body: unknown = await res.json();

    if (body === null || typeof body !== "object" || !("error" in body)) {
      throw new Error("expected an error envelope");
    }
  });

  test("covers a route registered on the parent, not just the plugin", async () => {
    /*
     * The shape that was broken: hooks are `local` by default, so the cap
     * did not apply to routes the parent registered after `use`ing it.
     */
    const parent = new Elysia()
      .onError(({ code, error, set }) =>
        errorHandler({ code: String(code), error, set })
      )
      .use(bodyLimit)
      .post("/sibling", () => ({ ok: true }), {
        body: t.Unknown(),
        response: t.Object({ ok: t.Boolean() }),
        detail: { tags: ["Test"] },
      });

    const res = await parent.handle(
      new Request("http://localhost/sibling", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(MAX_BODY_SIZE_BYTES + 1),
        },
        body: JSON.stringify({ data: "x" }),
      })
    );

    expect(res.status).toBe(413);
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
