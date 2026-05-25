import { describe, expect, test } from "bun:test";

import { buildEmailService } from "../../../src/lib/email/email.service.utils";

describe("buildEmailService", () => {
  test("returns an email service with a known providerName", () => {
    const service = buildEmailService();

    expect(service).toBeDefined();
    expect(typeof service.send).toBe("function");
    expect(typeof service.providerName).toBe("string");
  });

  test("providerName is one of the known providers", () => {
    const service = buildEmailService();
    const valid: readonly string[] = [
      "resend",
      "sendgrid",
      "cloudflare",
      "smtp",
      "noop",
    ];

    expect(valid.includes(service.providerName)).toBe(true);
  });

  test("returns the same provider type on repeated calls", () => {
    const first = buildEmailService();
    const second = buildEmailService();

    /*
     * Both should be the same provider type (test env forces noop unless
     * EMAIL_PROVIDER is explicitly set)
     */
    expect(first.providerName).toBe(second.providerName);
  });
});
