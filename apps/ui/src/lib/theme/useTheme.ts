import { useCallback, useEffect, useState } from "react";

import { localStore } from "@/lib/storage/localStorage";

import { THEME_STORAGE_KEY } from "./theme.constants";
import type { IThemeState, ThemeName } from "./theme.types";
import { applyTheme, resolveInitialTheme } from "./theme.utils";

export function useTheme(): IThemeState {
  const [theme, setThemeState] = useState<ThemeName>(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    localStore.set(THEME_STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeName = current === "dark" ? "light" : "dark";

      localStore.set(THEME_STORAGE_KEY, next);

      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
