import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordProductEvent } from "./product-events.service";

const state = vi.hoisted(() => ({ granted: false }));
const apiPost = vi.hoisted(() => vi.fn());
const track = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({
  apiClient: { POST: apiPost }
}));

vi.mock("./analytics.service", () => ({
  isAnalyticsGranted: () => state.granted,
  trackEvent: track
}));

describe("recordProductEvent", () => {
  beforeEach(() => {
    apiPost.mockReset();
    track.mockReset();
    apiPost.mockResolvedValue({ data: undefined });
  });

  it("sends nothing without analytics consent", () => {
    state.granted = false;
    recordProductEvent("checkout_started");

    expect(apiPost).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("records the allowlisted kind with consent, and counts it for GA", () => {
    state.granted = true;
    recordProductEvent("feedback_given");

    expect(apiPost).toHaveBeenCalledWith("/api/v1/product-events/", {
      body: { kind: "feedback_given", context: "" }
    });
    expect(track).toHaveBeenCalledWith("feedback_given");
  });

  it("swallows a failed request, so the action it records still succeeds", async () => {
    state.granted = true;
    apiPost.mockRejectedValueOnce(new Error("offline"));

    expect(() => {
      recordProductEvent("checkout_started");
    }).not.toThrow();
    await Promise.resolve();
  });
});
