import { describe, expect, test } from "bun:test";

import { ResendEmailService } from "../../../../src/lib/email/providers/resend";

describe("ResendEmailService", () => {
  test("constructor accepts an API key without throwing", () => {
    const svc = new ResendEmailService("re_fake_key");

    expect(svc.providerName).toBe("resend");
  });

  test("send validates the message and rejects an empty subject", async () => {
    const svc = new ResendEmailService("re_fake_key");

    let captured: unknown;

    try {
      await svc.send({ to: "a@example.com", subject: "", html: "<p>x</p>" });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });
});
