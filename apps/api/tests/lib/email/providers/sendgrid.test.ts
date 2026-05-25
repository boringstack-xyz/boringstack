import { describe, expect, test } from "bun:test";

import { SendGridEmailService } from "../../../../src/lib/email/providers/sendgrid";
import type { ISendGridMailClient } from "../../../../src/lib/email/providers/sendgrid.types";

const failingClient = (): ISendGridMailClient => ({
  setApiKey: () => undefined,
  send: () => Promise.reject(new Error("synthetic SendGrid failure")),
});

describe("SendGridEmailService", () => {
  test("constructor accepts an API key without throwing", () => {
    const svc = new SendGridEmailService("SG.fake-key");

    expect(svc.providerName).toBe("sendgrid");
  });

  test("send validates the message and rejects an empty subject", async () => {
    const svc = new SendGridEmailService("SG.fake-key");

    let captured: unknown;

    try {
      await svc.send({ to: "a@example.com", subject: "", html: "<p>x</p>" });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });

  test("send validates the message and rejects empty html", async () => {
    const svc = new SendGridEmailService("SG.fake-key");

    let captured: unknown;

    try {
      await svc.send({ to: "a@example.com", subject: "Subj", html: "" });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });

  test("send wraps SendGrid client failures", async () => {
    const svc = new SendGridEmailService("SG.fake-key", failingClient());

    let captured: unknown;

    try {
      await svc.send({
        to: "a@example.com",
        subject: "Subj",
        html: "<p>x</p>",
        text: "x",
      });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });
});
