import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localStore } from "@/lib/storage/localStorage";

import { THEME_DATA_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme.constants";
import {
  applyTheme,
  isThemeName,
  readStoredTheme,
  readSystemPreference,
  resolveInitialTheme
} from "./theme.utils";

describe("isThemeName", () => {
  it("accepts 'light' and 'dark'", () => {
    expect(isThemeName("light")).toBe(true);
    expect(isThemeName("dark")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isThemeName("blue")).toBe(false);
    expect(isThemeName(null)).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
    expect(isThemeName(123)).toBe(false);
    expect(isThemeName({})).toBe(false);
  });
});

describe("readStoredTheme", () => {
  beforeEach(() => {
    localStore.remove(THEME_STORAGE_KEY);
  });

  it("returns the stored theme name when valid", () => {
    localStore.set(THEME_STORAGE_KEY, "dark");

    expect(readStoredTheme()).toBe("dark");
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredTheme()).toBeNull();
  });

  it("returns null when the stored value is not a theme name", () => {
    localStore.set(THEME_STORAGE_KEY, "neon");

    expect(readStoredTheme()).toBeNull();
  });
});

describe("readSystemPreference", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 'dark' when prefers-color-scheme: dark matches", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    expect(readSystemPreference()).toBe("dark");
  });

  it("returns 'light' when prefers-color-scheme: dark does not match", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));

    expect(readSystemPreference()).toBe("light");
  });
});

describe("resolveInitialTheme", () => {
  afterEach(() => {
    localStore.remove(THEME_STORAGE_KEY);
    vi.unstubAllGlobals();
  });

  it("prefers the stored value over the system preference", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    localStore.set(THEME_STORAGE_KEY, "light");

    expect(resolveInitialTheme()).toBe("light");
  });

  it("falls back to the system preference when nothing is stored", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    expect(resolveInitialTheme()).toBe("dark");
  });
});

describe("applyTheme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(THEME_DATA_ATTRIBUTE);
  });

  it("writes data-theme on the document element", () => {
    applyTheme("dark");

    expect(document.documentElement.getAttribute(THEME_DATA_ATTRIBUTE)).toBe(
      "dark"
    );
  });

  it("overwrites a previous theme value", () => {
    applyTheme("dark");
    applyTheme("light");

    expect(document.documentElement.getAttribute(THEME_DATA_ATTRIBUTE)).toBe(
      "light"
    );
  });
});
