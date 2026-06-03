import { describe, expect, spyOn, test } from "bun:test";

import {
  isProviderSuppressionError,
  mirrorProviderSuppression,
} from "../../../../src/lib/email/providers/suppression.helpers";
import { emailSuppressionService } from "../../../../src/lib/email/suppression.service";

describe("isProviderSuppressionError", () => {
  test("matches known suppression markers case-insensitively", () => {
    expect(isProviderSuppressionError("Recipient SUPPRESSED by policy")).toBe(
      true
    );
    expect(
      isProviderSuppressionError("550 recipient address rejected: bounce")
    ).toBe(true);
    expect(isProviderSuppressionError("Address is Invalid")).toBe(true);
  });

  test("does not match transient provider errors", () => {
    expect(isProviderSuppressionError("503 service unavailable")).toBe(false);
    expect(isProviderSuppressionError("rate limit exceeded")).toBe(false);
    expect(isProviderSuppressionError("")).toBe(false);
  });
});

describe("mirrorProviderSuppression", () => {
  test("records the suppression locally with the provider verdict", async () => {
    const recordSpy = spyOn(
      emailSuppressionService,
      "record"
    ).mockResolvedValue({ recorded: true });

    try {
      await mirrorProviderSuppression(
        "user@example.com",
        "sendgrid",
        "550 suppressed"
      );

      expect(recordSpy).toHaveBeenCalledTimes(1);
      expect(recordSpy).toHaveBeenCalledWith({
        email: "user@example.com",
        reason: "provider_suppressed",
        provider: "sendgrid",
        metadata: { detail: "550 suppressed" },
      });
    } finally {
      recordSpy.mockRestore();
    }
  });

  test("skips empty recipients without touching the service", async () => {
    const recordSpy = spyOn(
      emailSuppressionService,
      "record"
    ).mockResolvedValue({ recorded: true });

    try {
      await mirrorProviderSuppression("", "sendgrid", "detail");

      expect(recordSpy).not.toHaveBeenCalled();
    } finally {
      recordSpy.mockRestore();
    }
  });
});
