import { describe, expect, test } from "bun:test";

import { isFeedbackMoment } from "../../../src/api/feedback/feedback.utils";

describe("isFeedbackMoment", () => {
  test("accepts the moments the product asks at", () => {
    expect(isFeedbackMoment("onboarded")).toBe(true);
    expect(isFeedbackMoment("upgraded")).toBe(true);
  });

  test("refuses anything else", () => {
    expect(isFeedbackMoment("")).toBe(false);
    expect(isFeedbackMoment("Onboarded")).toBe(false);
    expect(isFeedbackMoment("onboarded/extra")).toBe(false);
  });
});
