import { describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";

describe("Webhook route barrel mount", () => {
  test("the resend webhook subpath is mounted", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/webhooks/resend", {
        method: "POST",
        body: "{}",
      })
    );

    /*
     * 400 (missing svix headers) — proves the route exists and the handler
     * executed. 404 would mean the mount is broken.
     */
    expect(res.status).not.toBe(404);
  });

  test("the sendgrid webhook subpath is mounted", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/webhooks/sendgrid", {
        method: "POST",
        body: "[]",
      })
    );

    expect(res.status).not.toBe(404);
  });

  test("GET on a webhook subpath is not accepted", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/webhooks/resend")
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
