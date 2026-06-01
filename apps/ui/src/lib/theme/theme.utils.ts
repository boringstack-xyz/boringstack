import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";
import { localStore } from "@/lib/storage/localStorage";

import { THEME_DATA_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme.constants";
import type { ThemeName } from "./theme.types";

export function isThemeName(value: unknown): value is ThemeName {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): ThemeName | null {
  const stored = localStore.get(THEME_STORAGE_KEY);

  return isThemeName(stored) ? stored : null;
}

export function readSystemPreference(): ThemeName {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveInitialTheme(): ThemeName {
  return readStoredTheme() ?? readSystemPreference();
}

export function applyTheme(theme: ThemeName): void {
  if (typeof document === "undefined") {
    return;
  }

  try {
    document.documentElement.setAttribute(THEME_DATA_ATTRIBUTE, theme);
  } catch (error) {
    logger.warn({
      event: "theme.set_failed",
      theme,
      error: getErrorMessage(error)
    });
  }
}
