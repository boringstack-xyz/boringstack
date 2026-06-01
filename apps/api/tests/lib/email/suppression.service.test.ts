import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  EMAIL_SUPPRESSION_PROVIDERS,
  EMAIL_SUPPRESSION_REASONS,
  emailSuppressionService,
} from "../../../src/lib/email";
import {
  cleanDatabase,
  db,
  emailSuppression,
  eq,
  requireDb,
} from "../../helpers/db";

describe("EmailSuppressionService", () => {
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

  test("record persists the row and reports recorded=true", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await emailSuppressionService.record({
      email: "bouncer@example.com",
      reason: EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE,
      provider: EMAIL_SUPPRESSION_PROVIDERS.RESEND,
      providerMessageId: "msg_123",
      metadata: { code: "5.1.1" },
    });

    expect(result.recorded).toBe(true);

    const rows = await db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, "bouncer@example.com"));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe(EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE);
    expect(rows[0]?.provider).toBe(EMAIL_SUPPRESSION_PROVIDERS.RESEND);
    expect(rows[0]?.providerMessageId).toBe("msg_123");
    expect(rows[0]?.metadata).toEqual({ code: "5.1.1" });
  });

  test("record normalizes the email to lowercase before storing", async () => {
    if (!(await requireDb())) {
      return;
    }

    await emailSuppressionService.record({
      email: "  MixedCase@Example.COM  ",
      reason: EMAIL_SUPPRESSION_REASONS.COMPLAINT,
      provider: EMAIL_SUPPRESSION_PROVIDERS.SENDGRID,
    });

    const rows = await db.select().from(emailSuppression);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("mixedcase@example.com");
  });

  test("record is idempotent — a second call for the same address returns recorded=false", async () => {
    if (!(await requireDb())) {
      return;
    }

    await emailSuppressionService.record({
      email: "x@example.com",
      reason: EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE,
      provider: EMAIL_SUPPRESSION_PROVIDERS.RESEND,
    });

    const second = await emailSuppressionService.record({
      email: "x@example.com",
      reason: EMAIL_SUPPRESSION_REASONS.COMPLAINT,
      provider: EMAIL_SUPPRESSION_PROVIDERS.SENDGRID,
    });

    expect(second.recorded).toBe(false);

    const rows = await db.select().from(emailSuppression);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe(EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE);
    expect(rows[0]?.provider).toBe(EMAIL_SUPPRESSION_PROVIDERS.RESEND);
  });

  test("isSuppressed returns the entry when a match exists", async () => {
    if (!(await requireDb())) {
      return;
    }

    await emailSuppressionService.record({
      email: "blocked@example.com",
      reason: EMAIL_SUPPRESSION_REASONS.COMPLAINT,
      provider: EMAIL_SUPPRESSION_PROVIDERS.SENDGRID,
    });

    const entry = await emailSuppressionService.isSuppressed(
      "blocked@example.com"
    );

    expect(entry).not.toBeNull();
    expect(entry?.reason).toBe(EMAIL_SUPPRESSION_REASONS.COMPLAINT);
    expect(entry?.provider).toBe(EMAIL_SUPPRESSION_PROVIDERS.SENDGRID);
  });

  test("isSuppressed returns null when no row exists", async () => {
    if (!(await requireDb())) {
      return;
    }

    const entry =
      await emailSuppressionService.isSuppressed("clean@example.com");

    expect(entry).toBeNull();
  });

  test("isSuppressed normalizes the lookup email", async () => {
    if (!(await requireDb())) {
      return;
    }

    await emailSuppressionService.record({
      email: "case@example.com",
      reason: EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE,
      provider: EMAIL_SUPPRESSION_PROVIDERS.RESEND,
    });

    const entry = await emailSuppressionService.isSuppressed(
      "  CASE@Example.COM  "
    );

    expect(entry).not.toBeNull();
    expect(entry?.email).toBe("case@example.com");
  });

  test("clear removes the row and reports cleared=true", async () => {
    if (!(await requireDb())) {
      return;
    }

    await emailSuppressionService.record({
      email: "fresh@example.com",
      reason: EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE,
      provider: EMAIL_SUPPRESSION_PROVIDERS.RESEND,
    });

    const result = await emailSuppressionService.clear("fresh@example.com");

    expect(result.cleared).toBe(true);

    const rows = await db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, "fresh@example.com"));

    expect(rows).toHaveLength(0);
  });

  test("clear reports cleared=false when no row exists", async () => {
    if (!(await requireDb())) {
      return;
    }

    const result = await emailSuppressionService.clear("nope@example.com");

    expect(result.cleared).toBe(false);
  });
});
