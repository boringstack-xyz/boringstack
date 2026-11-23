import { describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";

const UNSUBSCRIBE = "/api/v1/lifecycle/unsubscribe";

describe("lifecycle unsubscribe route", () => {
  test("GET shows the confirm page and does not unsubscribe", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request(`http://localhost${UNSUBSCRIBE}?token=abc.def`)
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain('method="post"');
  });

  test("POST with a token that does not verify reports that the link did not work", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request(`http://localhost${UNSUBSCRIBE}?token=abc.def`, {
        method: "POST",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("That link didn");
  });

  test("POST without a token is rejected by validation, not treated as a success", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request(`http://localhost${UNSUBSCRIBE}`, { method: "POST" })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
