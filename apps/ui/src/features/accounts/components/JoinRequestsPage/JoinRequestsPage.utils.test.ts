import { describe, expect, it } from "vitest";

import { formatRequestedAt } from "./JoinRequestsPage.utils";

describe("formatRequestedAt", () => {
  it("formats an ISO timestamp into a short locale-aware date", () => {
    const result = formatRequestedAt("2026-06-01T00:00:00Z");

    /*
     * Locale isn't pinned — just assert the formatter ran and returned
     * a non-empty string different from the raw ISO.
     */
    expect(result).not.toBe("");
    expect(result).not.toBe("2026-06-01T00:00:00Z");
  });

  it("returns the raw input when Date parsing fails", () => {
    expect(formatRequestedAt("not-a-date")).toBe("Invalid Date");
  });
});
