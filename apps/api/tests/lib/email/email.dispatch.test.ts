import { describe, expect, test } from "bun:test";

import {
  sendTemplate,
  sendTemplateNow,
} from "../../../src/lib/email/email.dispatch";

describe("sendTemplate (test process → inline via noop)", () => {
  test("returns void and does not throw on a real precompiled template", async () => {
    /*
     * The test env has QUEUES_ENABLED=false (default) so this falls
     * through to `sendTemplateNow`, which renders + dispatches via the
     * noop email provider. We pick a template that's part of the repo's
     * precompiled output so the render succeeds.
     */
    let threw = false;

    try {
      await sendTemplate({
        to: "user@example.com",
        subject: "Welcome",
        templatePath: "auth/confirm-your-email",
        variables: {
          appName: "Test App",
          confirmationUrl: "https://example.com/verify-email?token=x",
          token: "x",
        },
      });
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
  });

  test("rejects with a clear error when the template does not exist", async () => {
    let captured: unknown;

    try {
      await sendTemplate({
        to: "user@example.com",
        subject: "Subj",
        templatePath: "does/not/exist",
        variables: {},
      });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });

  test("sendTemplateNow renders and dispatches a real template inline", async () => {
    let threw = false;

    try {
      await sendTemplateNow({
        to: "user@example.com",
        subject: "Welcome",
        templatePath: "auth/confirm-your-email",
        variables: {
          appName: "Test App",
          confirmationUrl: "https://example.com/verify-email?token=x",
          token: "x",
        },
      });
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
  });

  test("sendTemplateNow rejects an unknown template path", async () => {
    let captured: unknown;

    try {
      await sendTemplateNow({
        to: "user@example.com",
        subject: "Subj",
        templatePath: "does/not/exist",
        variables: {},
      });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
  });
});
