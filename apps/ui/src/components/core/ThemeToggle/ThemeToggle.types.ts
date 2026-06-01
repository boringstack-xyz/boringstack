import type { ThemeName } from "@/lib/theme";

export interface IThemeToggleProps {
  readonly className?: string;
}

export interface IThemeToggleView {
  readonly className: string | undefined;
  readonly theme: ThemeName;
  readonly nextTheme: ThemeName;
  readonly ariaLabel: string;
  readonly onToggle: () => void;
}
