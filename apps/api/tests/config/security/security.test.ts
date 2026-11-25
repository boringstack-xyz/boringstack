import { describe, expect, it } from "bun:test";

import { extractTrustedClientIp } from "../../../src/config/security/security";

describe("extractTrustedClientIp", () => {
  it("returns the leftmost X-Forwarded-For entry (client-closest)", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: "203.0.113.7, 10.0.0.1, 10.0.0.2",
        socketAddress: "10.0.0.2",
      })
    ).toBe("203.0.113.7");
  });

  it("trims whitespace from the leftmost entry", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: "  203.0.113.7  , 10.0.0.1",
        socketAddress: undefined,
      })
    ).toBe("203.0.113.7");
  });

  it("falls back to the socket address when X-Forwarded-For is absent", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: null,
        socketAddress: "192.0.2.5",
      })
    ).toBe("192.0.2.5");
  });

  it("falls back to the socket address when X-Forwarded-For is empty", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: "",
        socketAddress: "192.0.2.5",
      })
    ).toBe("192.0.2.5");
  });

  it("returns empty string when neither is available — limiter treats this as anonymous", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: null,
        socketAddress: undefined,
      })
    ).toBe("");
  });
});

describe("scoped rate limits on a sub-app", () => {
  /*
   * The credential and route-group limits are mounted on sub-apps, whose own
   * `server` is null. Without the listening server injected, the plugin's key
   * generator warns and keys every client as "" : one shared bucket, so a
   * single client could lock everyone out of sign-in.
   */
  it("key each request by the client address of the listening server", async () => {
    const { Elysia, t } = await import("elysia");
    const { buildScopedRateLimit, setListeningServer } =
      await import("../../../src/config/security/security");
    const warnings: string[] = [];
    const original = console.warn;

    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };

    const routes = new Elysia()
      .use(buildScopedRateLimit("test-sub-app", { max: 5, durationMs: 60_000 }))
      .get("/limited", () => "ok", {
        response: t.String(),
        detail: { tags: ["test"] },
      });
    const app = new Elysia().use(routes).listen({ port: 0 });

    try {
      setListeningServer(app.server);

      const response = await fetch(
        `http://127.0.0.1:${String(app.server?.port)}/limited`
      );

      expect(response.status).toBe(200);
      expect(
        warnings.filter((line) => line.includes("elysia-rate-limit"))
      ).toEqual([]);
    } finally {
      console.warn = original;
      setListeningServer(null);
      await app.stop();
    }
  });
});
