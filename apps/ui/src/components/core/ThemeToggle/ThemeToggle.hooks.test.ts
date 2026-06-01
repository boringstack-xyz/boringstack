import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localStore } from "@/lib/storage/localStorage";
import { THEME_DATA_ATTRIBUTE, THEME_STORAGE_KEY } from "@/lib/theme";

import { useThemeToggle } from "./ThemeToggle.hooks";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en" }
    })
  };
});

describe("useThemeToggle", () => {
  beforeEach(() => {
    localStore.remove(THEME_STORAGE_KEY);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    document.documentElement.removeAttribute(THEME_DATA_ATTRIBUTE);
  });

  it("returns the active theme, the next theme, and an aria label keyed on the next theme", () => {
    const { result } = renderHook(() => useThemeToggle({}));

    expect(result.current.theme).toBe("light");
    expect(result.current.nextTheme).toBe("dark");
    expect(result.current.ariaLabel).toBe("theme.toggleTo.dark");
  });

  it("flips the nextTheme when the current theme changes", () => {
    localStore.set(THEME_STORAGE_KEY, "dark");

    const { result } = renderHook(() => useThemeToggle({}));

    expect(result.current.theme).toBe("dark");
    expect(result.current.nextTheme).toBe("light");
    expect(result.current.ariaLabel).toBe("theme.toggleTo.light");
  });

  it("passes className through unchanged", () => {
    const { result } = renderHook(() =>
      useThemeToggle({ className: "extra-class" })
    );

    expect(result.current.className).toBe("extra-class");
  });

  it("exposes a bound toggle function", () => {
    const { result } = renderHook(() => useThemeToggle({}));

    expect(typeof result.current.onToggle).toBe("function");
  });
});
