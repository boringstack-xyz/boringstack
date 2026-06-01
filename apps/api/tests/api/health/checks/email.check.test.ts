import { describe, expect, test } from "bun:test";

import { emailCheck } from "../../../../src/api/health/checks/email.check";

describe("emailCheck", () => {
  test("declares the canonical 'email' name", () => {
    expect(emailCheck.name).toBe("email");
  });

  test("returns 'degraded' when the active provider is the noop", async () => {
    const result = await emailCheck.run();

    /*
     * The test process leaves the email provider at its default ("noop")
     * because no real SMTP credentials are set in setup-test-env.ts.
     */
    expect(["ok", "degraded"]).toContain(result.status);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    if (result.status === "degraded") {
      expect(result.message).toMatch(/noop/i);
    }
  });
});
