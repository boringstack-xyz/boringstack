import { beforeEach, describe, expect, it, vi } from "vitest";

const measurement = vi.hoisted(() => ({ id: "G-TEST123" }));

vi.mock("@/lib/env", () => ({
  env: {
    get VITE_GA_MEASUREMENT_ID() {
      return measurement.id;
    }
  }
}));

type TQueued = ArrayLike<unknown>;

const queued = (): TQueued[] => {
  const queue: unknown = Reflect.get(window, "dataLayer");

  return Array.isArray(queue) ? (queue as TQueued[]) : [];
};

const gaScripts = (): Element[] =>
  Array.from(document.head.querySelectorAll('script[src*="googletagmanager"]'));

describe("consent-gated analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    measurement.id = "G-TEST123";
    gaScripts().forEach((script) => {
      script.remove();
    });
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "ga-disable-G-TEST123");
  });

  it("never requests Google before the visitor accepts analytics", async () => {
    const { trackEvent, trackPage } = await import("./analytics.service");

    trackPage("/dashboard");
    trackEvent("sign_up_completed", { method: "email" });

    expect(gaScripts()).toHaveLength(0);
    expect(Reflect.get(window, "dataLayer")).toBeUndefined();
  });

  it("loads GA once on acceptance and stops collecting on withdrawal", async () => {
    const { setAnalyticsConsent, trackPage } =
      await import("./analytics.service");

    setAnalyticsConsent(true);
    setAnalyticsConsent(true);
    expect(gaScripts()).toHaveLength(1);

    trackPage("/dashboard");
    const before = JSON.stringify(queued());

    setAnalyticsConsent(false);
    trackPage("/billing");

    expect(JSON.stringify(queued())).toBe(before);
    expect(Reflect.get(window, "ga-disable-G-TEST123")).toBe(true);
  });

  it("clears GA cookies on withdrawal", async () => {
    const { setAnalyticsConsent } = await import("./analytics.service");

    setAnalyticsConsent(true);
    document.cookie = "_ga=test; Path=/";
    setAnalyticsConsent(false);

    expect(document.cookie).not.toContain("_ga=");
  });

  it("is entirely off when no measurement id is configured", async () => {
    measurement.id = "";
    const { isAnalyticsGranted, setAnalyticsConsent, trackEvent } =
      await import("./analytics.service");

    setAnalyticsConsent(true);
    trackEvent("checkout_started");

    expect(isAnalyticsGranted()).toBe(false);
    expect(gaScripts()).toHaveLength(0);
  });

  it("sends only allowlisted events with allowlisted, short parameters", async () => {
    const { setAnalyticsConsent, trackEvent } =
      await import("./analytics.service");

    setAnalyticsConsent(true);
    trackEvent("checkout_started", { reason: "pro", step: 2 });
    trackEvent("checkout_started", {
      method: "a@b.example.com",
      reason: "x y"
    });

    const events = queued().map((entry) => Array.from(entry));

    expect(events).toContainEqual([
      "event",
      "checkout_started",
      { reason: "pro", step: 2 }
    ]);
    expect(JSON.stringify(events)).not.toContain("a@b.example.com");
    expect(JSON.stringify(events)).not.toContain("x y");
  });

  it("refuses an event name outside the allowlist", async () => {
    const { setAnalyticsConsent, trackEvent } =
      await import("./analytics.service");

    setAnalyticsConsent(true);
    trackEvent("purchase" as never);

    expect(JSON.stringify(queued())).not.toContain("purchase");
  });

  it("replaces record ids in page paths and keeps the rest", async () => {
    const { analyticsPath } = await import("./analytics.service");

    expect(analyticsPath("/account/settings")).toBe("/account/settings");
    expect(
      analyticsPath("/invitations/3f1c2b7e-9a1d-4c2e-8f00-123456789abc/accept")
    ).toBe("/invitations/:id/accept");
    expect(analyticsPath("/orders/123456789")).toBe("/orders/:id");
  });
});
