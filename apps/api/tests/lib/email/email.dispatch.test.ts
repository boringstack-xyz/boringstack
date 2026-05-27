import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  sendTemplate,
  sendTemplateNow,
} from "../../../src/lib/email/email.dispatch";
import {
  EMAIL_SUPPRESSION_PROVIDERS,
  EMAIL_SUPPRESSION_REASONS,
  emailSuppressionService,
} from "../../../src/lib/email";
import { cleanDatabase, requireDb } from "../../helpers/db";

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

describe("sendTemplateNow suppression short-circuit", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns status=suppressed and skips the provider when the address is on the blocklist", async () => {
    if (!(await requireDb())) {
      return;
    }

    await emailSuppressionService.record({
      email: "blocked@example.com",
      reason: EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE,
      provider: EMAIL_SUPPRESSION_PROVIDERS.RESEND,
    });

    const outcome = await sendTemplateNow({
      to: "blocked@example.com",
      subject: "Welcome",
      templatePath: "auth/confirm-your-email",
      variables: {
        appName: "Test App",
        confirmationUrl: "https://example.com/verify-email?token=x",
        token: "x",
      },
    });

    expect(outcome.status).toBe("suppressed");

    if (outcome.status === "suppressed") {
      expect(outcome.reason).toBe(EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE);
    }
  });

  test("returns status=sent for a clean address", async () => {
    if (!(await requireDb())) {
      return;
    }

    const outcome = await sendTemplateNow({
      to: "clean@example.com",
      subject: "Welcome",
      templatePath: "auth/confirm-your-email",
      variables: {
        appName: "Test App",
        confirmationUrl: "https://example.com/verify-email?token=x",
        token: "x",
      },
    });

    expect(outcome.status).toBe("sent");
  });
});
