import { describe, expect, test } from "bun:test";

import { NoopEmailService } from "../../../../src/lib/email/providers/noop";

describe("NoopEmailService", () => {
  test("providerName is 'noop'", () => {
    const svc = new NoopEmailService();

    expect(svc.providerName).toBe("noop");
  });

  test("send returns a unique id + the noop provider tag", async () => {
    const svc = new NoopEmailService();
    const first = await svc.send({
      to: "a@example.com",
      subject: "Subj",
      html: "<p>x</p>",
    });
    const second = await svc.send({
      to: "b@example.com",
      subject: "Subj",
      html: "<p>x</p>",
    });

    expect(first.provider).toBe("noop");
    expect(second.provider).toBe("noop");
    expect(first.id).not.toBe(second.id);
    expect(first.id.startsWith("noop_")).toBe(true);
  });

  test("send validates the message against the configured FROM (rejects empty subject)", async () => {
    const svc = new NoopEmailService();

    let captured: unknown;

    try {
      await svc.send({ to: "a@example.com", subject: "", html: "<p>x</p>" });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });

  test("send validates the message and rejects empty html", async () => {
    const svc = new NoopEmailService();

    let captured: unknown;

    try {
      await svc.send({ to: "a@example.com", subject: "Subj", html: "" });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });

  test("send accepts a text body in addition to html", async () => {
    const svc = new NoopEmailService();

    const result = await svc.send({
      to: "a@example.com",
      subject: "Subj",
      html: "<p>x</p>",
      text: "x",
    });

    expect(result.provider).toBe("noop");
  });
});
