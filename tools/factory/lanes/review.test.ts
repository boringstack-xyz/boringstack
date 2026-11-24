import { describe, expect, test } from "bun:test";

import { replaceReviewSection } from "./review";

const body = [
  "# Verification: agent/triage/fix",
  "",
  "Commit: abcdef1",
  "",
  "## Risk",
  "",
  "logic: cache key",
  "",
  "## Review",
  "",
  "Pending the independent reviewer.",
  "",
  "## Not verified",
  "",
  "Nothing",
  "",
].join("\n");

describe("the Review section of a record", () => {
  test("replaces only the text under Review", () => {
    const next = replaceReviewSection(
      body,
      "Approved: the diff fixes the cause."
    );

    expect(next).toContain(
      "## Review\n\nApproved: the diff fixes the cause.\n\n## Not verified"
    );
    expect(next).toContain("## Risk\n\nlogic: cache key");
    expect(next).not.toContain("Pending the independent reviewer.");
  });

  test("a record with no Review section gets one at the end", () => {
    const next = replaceReviewSection(
      "# Verification\n\n## Risk\n\nui: copy",
      "Rejected: no test."
    );

    expect(next.endsWith("## Review\n\nRejected: no test.\n")).toBe(true);
  });

  test("a Review section at the end of the body is replaced to the end", () => {
    const next = replaceReviewSection("## Review\n\nold", "new");

    expect(next).toBe("## Review\n\nnew\n");
  });
});
