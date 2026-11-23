import { describe, expect, test } from "bun:test";

import {
  emailsToResend,
  softBounceAuditEvents,
} from "../../../src/lib/email/soft-bounce-recovery.utils";

const MINUTE = 60_000;
const BLOCKED_AT = 1_800_000_000_000;
const SAM = "sam@example.com";

const handled = (
  to: string,
  templatePath: string,
  minutesFromBlock: number,
  subject = templatePath
) => ({
  data: { to, subject, templatePath },
  finishedAtMs: BLOCKED_AT + minutesFromBlock * MINUTE,
});

describe("emailsToResend", () => {
  test("takes the emails to that address from shortly before the block, oldest first", () => {
    const due = emailsToResend(
      [
        handled(SAM, "lifecycle/welcome", 6),
        handled(SAM, "catalog-submission/private-only", -10, "a"),
        handled(SAM, "catalog-submission/private-only", -11, "b"),
        handled(SAM, "lifecycle/no-board", -45),
        handled("other@example.com", "lifecycle/welcome", -5),
      ],
      " Sam@Example.com ",
      BLOCKED_AT
    );

    expect(due.map((item) => item.subject)).toEqual([
      "b",
      "a",
      "lifecycle/welcome",
    ]);
  });

  test("sends a sign-in email once, as its newest copy", () => {
    const due = emailsToResend(
      [
        handled(SAM, "auth/confirm-your-email", -10, "first"),
        handled(SAM, "auth/confirm-your-email", -4, "second"),
        handled(SAM, "auth/reset-password", -3, "reset"),
      ],
      SAM,
      BLOCKED_AT
    );

    expect(due.map((item) => item.subject)).toEqual(["second", "reset"]);
  });
});

describe("softBounceAuditEvents", () => {
  test("a run that touched nothing records nothing", () => {
    expect(
      softBounceAuditEvents({ found: 2, lifted: 0, resent: 0, failed: 0 })
    ).toEqual([]);
  });

  test("records what went out again and what failed, as counts with no actor", () => {
    expect(
      softBounceAuditEvents({ found: 3, lifted: 2, resent: 3, failed: 1 })
    ).toEqual([
      {
        userId: null,
        action: "email.soft_bounce_recovered",
        metadata: { addresses: 2, resent: 3 },
      },
      {
        userId: null,
        action: "email.soft_bounce_recovery_failed",
        metadata: { addresses: 1 },
      },
    ]);
  });
});
