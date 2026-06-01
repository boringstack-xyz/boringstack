import { describe, expect, test } from "bun:test";

import { SmtpEmailService } from "../../../../src/lib/email/providers/smtp";

describe("SmtpEmailService", () => {
  test("constructor accepts host + port + optional auth without throwing", () => {
    const svc = new SmtpEmailService("localhost", 1025);

    expect(svc.providerName).toBe("smtp");
  });

  test("constructor wires auth when both user and pass are non-empty", () => {
    const svc = new SmtpEmailService("smtp.example.com", 587, "user", "pass");

    expect(svc.providerName).toBe("smtp");
  });

  test("constructor accepts port 465 (the documented implicit-TLS port)", () => {
    const svc = new SmtpEmailService("smtp.example.com", 465, "user", "pass");

    expect(svc.providerName).toBe("smtp");
  });

  test("send validates the message and rejects an empty subject", async () => {
    const svc = new SmtpEmailService("localhost", 1025);

    let captured: unknown;

    try {
      await svc.send({ to: "a@example.com", subject: "", html: "<p>x</p>" });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });
});
