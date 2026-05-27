import { beforeEach, describe, expect, it } from "vitest";

import { useCookieConsentStore } from "./CookieConsent.store";

describe("useCookieConsentStore", () => {
  beforeEach(() => {
    useCookieConsentStore.getState().reset();
    localStorage.removeItem("bs.cookie-consent.v1");
  });

  it("starts in the 'unset' status with essential-only categories", () => {
    const state = useCookieConsentStore.getState();

    expect(state.status).toBe("unset");
    expect(state.categories).toEqual({
      essential: true,
      analytics: false,
      marketing: false
    });
    expect(state.configuredAt).toBeNull();
  });

  it("acceptAll enables every category and stamps configuredAt", () => {
    useCookieConsentStore.getState().acceptAll();

    const state = useCookieConsentStore.getState();

    expect(state.status).toBe("configured");
    expect(state.categories).toEqual({
      essential: true,
      analytics: true,
      marketing: true
    });
    expect(state.configuredAt).not.toBeNull();
  });

  it("rejectNonEssential leaves only essential on", () => {
    useCookieConsentStore.getState().rejectNonEssential();

    const state = useCookieConsentStore.getState();

    expect(state.status).toBe("configured");
    expect(state.categories).toEqual({
      essential: true,
      analytics: false,
      marketing: false
    });
    expect(state.configuredAt).not.toBeNull();
  });

  it("setCategories updates only the provided category, leaves others intact", () => {
    useCookieConsentStore.getState().acceptAll();
    useCookieConsentStore.getState().setCategories({ marketing: false });

    const state = useCookieConsentStore.getState();

    expect(state.categories).toEqual({
      essential: true,
      analytics: true,
      marketing: false
    });
  });

  it("essential cannot be turned off", () => {
    useCookieConsentStore.getState().setCategories({ analytics: false });

    expect(useCookieConsentStore.getState().categories.essential).toBe(true);
  });

  it("reset returns the store to its initial state", () => {
    useCookieConsentStore.getState().acceptAll();
    useCookieConsentStore.getState().reset();

    const state = useCookieConsentStore.getState();

    expect(state.status).toBe("unset");
    expect(state.configuredAt).toBeNull();
  });
});
