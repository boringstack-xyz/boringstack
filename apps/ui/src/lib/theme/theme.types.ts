export type ThemeName = "light" | "dark";

export interface IThemeState {
  readonly theme: ThemeName;
  readonly setTheme: (next: ThemeName) => void;
  readonly toggle: () => void;
}
