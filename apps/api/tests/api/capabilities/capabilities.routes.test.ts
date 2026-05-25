import { describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";

const isCapabilitiesBody = (
  value: unknown
): value is {
  features: {
    notifications: { sse: boolean; webPush: boolean };
    billing: { enabled: boolean };
    ai: { enabled: boolean };
  };
  oauth: { providers: string[] };
} =>
  value !== null &&
  typeof value === "object" &&
  "features" in value &&
  "oauth" in value;

describe("GET /api/v1/capabilities", () => {
  test("returns public runtime feature and OAuth capabilities", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/capabilities")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");

    const body: unknown = await res.json();

    if (!isCapabilitiesBody(body)) {
      throw new Error("expected a capabilities body");
    }

    expect(typeof body.features.notifications.sse).toBe("boolean");
    expect(typeof body.features.notifications.webPush).toBe("boolean");
    expect(typeof body.features.billing.enabled).toBe("boolean");
    expect(typeof body.features.ai.enabled).toBe("boolean");
    expect(Array.isArray(body.oauth.providers)).toBe(true);
  });
});
