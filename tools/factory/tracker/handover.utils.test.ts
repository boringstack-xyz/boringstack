import { describe, expect, test } from "bun:test";

import { completeRecord } from "./tracker.fixtures";
import { handoverCard, riskReason } from "./handover.utils";

const record = completeRecord({
  branch: "factory/12",
  commit: "abc1234def",
});

describe("handoverCard", () => {
  test("says what to try, the preview, the review depth and what was not verified", () => {
    const card = handoverCard({
      title: "Billing button copy",
      branch: "factory/12",
      preview: "http://127.0.0.1:7412",
      record,
    });

    expect(card).toContain("### Ready to review: Billing button copy");
    expect(card).toContain("**Preview:** http://127.0.0.1:7412");
    expect(card).toContain(
      "**How much review:** ui (button copy on the billing page). Copy, layout or styling only"
    );
    expect(card).toContain("- the Safari layout (no Safari in the stack)");
    expect(card).toContain("- /billing: the new copy shows");
    expect(card).toContain("checks ran at commit abc1234def");
    expect(card).not.toContain("# Verification");
  });

  test("says plainly when there is no preview and nothing is left unverified", () => {
    const card = handoverCard({
      title: "Copy",
      branch: "factory/12",
      preview: undefined,
      record: completeRecord({
        branch: "factory/12",
        commit: "abc1234def",
        notVerified: "Nothing",
      }),
    });

    expect(card).toContain("none is running for this change");
    expect(card).toContain("Nothing left unverified.");
  });
});

describe("riskReason", () => {
  test("the text after the risk level's colon", () => {
    expect(riskReason(record)).toBe("button copy on the billing page");
  });
});
