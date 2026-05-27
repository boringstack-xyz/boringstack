import { describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";

describe("GET /metrics", () => {
  test("returns 200 with Prometheus exposition content-type", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/metrics"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/plain");
  });

  test("the body contains at least one prom-client default metric", async () => {
    const app = createApp();
    const res = await app.handle(new Request("http://localhost/metrics"));
    const body = await res.text();

    expect(body).toContain("# HELP");
    expect(body).toContain("# TYPE");
  });
});
