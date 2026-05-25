import { describe, expect, test } from "bun:test";

import { emailTemplateService } from "../../../src/lib/email/template.service";

describe("emailTemplateService", () => {
  test("renders a known precompiled template to a non-empty HTML string", () => {
    const html = emailTemplateService.render("auth/confirm-your-email", {
      appName: "Acme",
      confirmationUrl: "https://acme.test/verify-email?token=t",
      token: "t",
    });

    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  test("substitutes Handlebars variables into the rendered output", () => {
    const html = emailTemplateService.render("auth/confirm-your-email", {
      appName: "AcmeBrand",
      confirmationUrl: "https://acme.test/verify-email?token=abc",
      token: "abc",
    });

    expect(html).toContain("AcmeBrand");
  });

  test("rejects empty template paths with a validation error", () => {
    expect(() => emailTemplateService.render("", {})).toThrow();
  });

  test("rejects unknown template paths with a not-found error", () => {
    expect(() => emailTemplateService.render("does/not/exist", {})).toThrow(
      /not found/i
    );
  });
});
