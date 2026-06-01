import { describe, expect, test } from "bun:test";

import { aiCheck } from "../../../../src/api/health/checks/ai.check";

describe("aiCheck", () => {
  test("declares the canonical 'ai' name", () => {
    expect(aiCheck.name).toBe("ai");
  });

  test("returns a result with a non-negative latency", async () => {
    const result = await aiCheck.run();

    expect(result.name).toBe("ai");
    expect(["ok", "down", "degraded"]).toContain(result.status);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("reports a non-empty message when the status is 'down'", async () => {
    const result = await aiCheck.run();

    if (result.status !== "down") {
      return;
    }

    expect(typeof result.message).toBe("string");
    expect(result.message?.length).toBeGreaterThan(0);
  });
});
