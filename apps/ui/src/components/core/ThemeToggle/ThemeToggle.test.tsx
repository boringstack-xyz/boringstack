import { fireEvent, render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localStore } from "@/lib/storage/localStorage";
import { THEME_DATA_ATTRIBUTE, THEME_STORAGE_KEY } from "@/lib/theme";

import ThemeToggle from "./ThemeToggle";

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

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStore.remove(THEME_STORAGE_KEY);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    document.documentElement.removeAttribute(THEME_DATA_ATTRIBUTE);
  });

  it("renders with the aria label for the next theme", () => {
    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: "theme.toggleTo.dark" })
    ).toBeInTheDocument();
  });

  it("flips the theme on click and updates the aria label", () => {
    render(<ThemeToggle />);

    fireEvent.click(
      screen.getByRole("button", { name: "theme.toggleTo.dark" })
    );

    expect(document.documentElement.getAttribute(THEME_DATA_ATTRIBUTE)).toBe(
      "dark"
    );
    expect(
      screen.getByRole("button", { name: "theme.toggleTo.light" })
    ).toBeInTheDocument();
  });
});
