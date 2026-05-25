import { describe, expect, test } from "bun:test";

import { emailService } from "../../../src/lib/email/email.service";

describe("emailService (singleton)", () => {
  test("exposes the IEmailService contract", () => {
    expect(typeof emailService.send).toBe("function");
    expect(typeof emailService.providerName).toBe("string");
  });

  test("provider name is one of the known providers", () => {
    expect(["resend", "sendgrid", "smtp", "noop"]).toContain(
      emailService.providerName
    );
  });

  test("defaults to noop in the test process (no SMTP/Resend keys in setup-test-env.ts)", () => {
    expect(emailService.providerName).toBe("noop");
  });

  test("noop send returns an IEmailResult tagged with the noop provider", async () => {
    const result = await emailService.send({
      to: "x@example.com",
      subject: "ignored",
      html: "<p>hi</p>",
    });

    expect(result.provider).toBe("noop");
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });
});
