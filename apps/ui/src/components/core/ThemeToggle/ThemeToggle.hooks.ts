import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";

import type { IThemeToggleProps, IThemeToggleView } from "./ThemeToggle.types";

export function useThemeToggle(props: IThemeToggleProps): IThemeToggleView {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return {
    className: props.className,
    theme,
    nextTheme,
    ariaLabel: t(`theme.toggleTo.${nextTheme}`),
    onToggle: toggle
  };
}
