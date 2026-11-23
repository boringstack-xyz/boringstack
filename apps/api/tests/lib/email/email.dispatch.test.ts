import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import {
  sendTemplate,
  sendTemplateNow,
} from "../../../src/lib/email/email.dispatch";
import { emailService } from "../../../src/lib/email/email.service";
import {
  EMAIL_SUPPRESSION_PROVIDERS,
  EMAIL_SUPPRESSION_REASONS,
  emailSuppressionService,
} from "../../../src/lib/email";
import { cleanDatabase, requireDb } from "../../helpers/db";

const CONFIRM_TEMPLATE = "auth/confirm-your-email";
const CONFIRM_URL = "https://example.com/verify-email?token=x";

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
        templatePath: CONFIRM_TEMPLATE,
        variables: {
          appName: "Test App",
          confirmationUrl: CONFIRM_URL,
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
        templatePath: CONFIRM_TEMPLATE,
        variables: {
          appName: "Test App",
          confirmationUrl: CONFIRM_URL,
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
      templatePath: CONFIRM_TEMPLATE,
      variables: {
        appName: "Test App",
        confirmationUrl: CONFIRM_URL,
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
      templatePath: CONFIRM_TEMPLATE,
      variables: {
        appName: "Test App",
        confirmationUrl: CONFIRM_URL,
        token: "x",
      },
    });

    expect(outcome.status).toBe("sent");
  });
});

describe("email dispatch to the verification robot", () => {
  test("sendTemplateNow and sendTemplate never reach the provider for a robot address", async () => {
    const send = spyOn(emailService, "send");
    const variables = {
      appName: "Test App",
      confirmationUrl: CONFIRM_URL,
      token: "x",
    };

    try {
      const direct = await sendTemplateNow({
        to: "robot-1@robot.boringstack.invalid",
        subject: "Welcome",
        templatePath: CONFIRM_TEMPLATE,
        variables,
      });
      const queued = await sendTemplate({
        to: "robot-2@robot.boringstack.invalid",
        subject: "Welcome",
        templatePath: CONFIRM_TEMPLATE,
        variables,
      });

      expect(direct.status).toBe("suppressed");
      expect(queued.status).toBe("suppressed");
      expect(send).not.toHaveBeenCalled();
    } finally {
      send.mockRestore();
    }
  });
});

describe("sendTemplateNow envelope", () => {
  test("hands the sender name, reply-to and headers to the provider", async () => {
    const send = spyOn(emailService, "send").mockResolvedValue({
      id: "test-id",
      provider: "noop",
    });

    try {
      await sendTemplateNow({
        to: "clean@example.com",
        subject: "Hello",
        templatePath: CONFIRM_TEMPLATE,
        variables: {
          appName: "Test App",
          confirmationUrl: CONFIRM_URL,
          token: "x",
        },
        envelope: {
          fromName: "Alex from Test App",
          replyTo: "hello@example.com",
          headers: { "List-Unsubscribe": "<https://example.com/u>" },
        },
      });

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "clean@example.com",
          fromName: "Alex from Test App",
          replyTo: "hello@example.com",
          headers: { "List-Unsubscribe": "<https://example.com/u>" },
        })
      );
    } finally {
      send.mockRestore();
    }
  });
});
