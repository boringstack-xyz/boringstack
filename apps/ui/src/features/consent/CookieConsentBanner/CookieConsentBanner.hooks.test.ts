import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useCookieConsentStore } from "../CookieConsent.store";
import { useCookieConsentBanner } from "./CookieConsentBanner.hooks";

describe("useCookieConsentBanner", () => {
  beforeEach(() => {
    useCookieConsentStore.getState().reset();
    localStorage.removeItem("bs.cookie-consent.v1");
  });

  it("isVisible is true when the user has not configured consent yet", () => {
    const { result } = renderHook(() => useCookieConsentBanner());

    expect(result.current.isVisible).toBe(true);
  });

  it("isVisible flips to false after acceptAll", () => {
    const { result } = renderHook(() => useCookieConsentBanner());

    act(() => {
      result.current.acceptAll();
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("openConfigure copies persisted categories into the draft", () => {
    useCookieConsentStore.getState().acceptAll();

    const { result } = renderHook(() => useCookieConsentBanner());

    act(() => {
      result.current.openConfigure();
    });

    expect(result.current.isConfigureOpen).toBe(true);
    expect(result.current.draftCategories.analytics).toBe(true);
    expect(result.current.draftCategories.marketing).toBe(true);
  });

  it("toggleDraftCategory mutates the draft but not the persisted store", () => {
    useCookieConsentStore.getState().acceptAll();

    const { result } = renderHook(() => useCookieConsentBanner());

    act(() => {
      result.current.openConfigure();
      result.current.toggleDraftCategory("analytics", false);
    });

    expect(result.current.draftCategories.analytics).toBe(false);
    expect(useCookieConsentStore.getState().categories.analytics).toBe(true);
  });

  it("essential cannot be toggled off via the draft", () => {
    const { result } = renderHook(() => useCookieConsentBanner());

    act(() => {
      result.current.openConfigure();
      result.current.toggleDraftCategory("essential", false);
    });

    expect(result.current.draftCategories.essential).toBe(true);
  });

  it("saveConfigure persists the draft and closes the modal", () => {
    useCookieConsentStore.getState().acceptAll();

    const { result } = renderHook(() => useCookieConsentBanner());

    act(() => {
      result.current.openConfigure();
      result.current.toggleDraftCategory("marketing", false);
      result.current.saveConfigure();
    });

    expect(result.current.isConfigureOpen).toBe(false);

    const persisted = useCookieConsentStore.getState();

    expect(persisted.status).toBe("configured");
    expect(persisted.categories.marketing).toBe(false);
    expect(persisted.categories.analytics).toBe(true);
  });
});
