import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localStore } from "@/lib/storage/localStorage";

import { THEME_DATA_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme.constants";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    localStore.remove(THEME_STORAGE_KEY);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    document.documentElement.removeAttribute(THEME_DATA_ATTRIBUTE);
  });

  it("initialises from the stored theme", () => {
    localStore.set(THEME_STORAGE_KEY, "dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute(THEME_DATA_ATTRIBUTE)).toBe(
      "dark"
    );
  });

  it("falls back to the system preference when nothing is stored", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
  });

  it("setTheme persists the choice and applies it to the document", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(localStore.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute(THEME_DATA_ATTRIBUTE)).toBe(
      "dark"
    );
  });

  it("toggle flips between light and dark", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe("light");
  });
});
