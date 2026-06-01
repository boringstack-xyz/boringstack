export const TOKENS_EYEBROW = "Design tokens";
export const TOKENS_TITLE = "Brand parity with boringstack.xyz";
export const TOKENS_DESCRIPTION =
  "Every color flows through these CSS variables. The two themes swap tokens; components never reference a theme directly.";

export const TOKEN_GROUPS = [
  {
    id: "surface",
    title: "Surface",
    swatches: [
      { name: "background", var: "--background", style: "bg-background" },
      { name: "panel", var: "--panel", style: "bg-panel" },
      { name: "panel-strong", var: "--panel-strong", style: "bg-panel-strong" },
      { name: "card", var: "--card", style: "bg-card" }
    ]
  },
  {
    id: "primary",
    title: "Primary",
    swatches: [
      { name: "primary", var: "--primary", style: "bg-primary" },
      {
        name: "primary-strong",
        var: "--primary-strong",
        style: "bg-primary-strong"
      },
      { name: "primary-low", var: "--primary-low", style: "bg-primary-low" },
      { name: "primary-ink", var: "--primary-ink", style: "bg-primary-ink" }
    ]
  },
  {
    id: "accent",
    title: "Accent",
    swatches: [
      { name: "accent", var: "--accent", style: "bg-accent" },
      {
        name: "accent-cyan",
        var: "--accent-cyan",
        style: "bg-accent-cyan"
      },
      {
        name: "accent-pink",
        var: "--accent-pink",
        style: "bg-accent-pink"
      }
    ]
  },
  {
    id: "text",
    title: "Text",
    swatches: [
      { name: "foreground", var: "--foreground", style: "bg-foreground" },
      {
        name: "muted-foreground",
        var: "--muted-foreground",
        style: "bg-muted-foreground"
      },
      { name: "muted-strong", var: "--muted-strong", style: "bg-muted-strong" }
    ]
  },
  {
    id: "border",
    title: "Border",
    swatches: [
      { name: "border", var: "--border", style: "bg-border" },
      {
        name: "border-strong",
        var: "--border-strong",
        style: "bg-border-strong"
      },
      { name: "ring", var: "--ring", style: "bg-ring" }
    ]
  },
  {
    id: "state",
    title: "State",
    swatches: [
      { name: "destructive", var: "--destructive", style: "bg-destructive" },
      { name: "success", var: "--success", style: "bg-success" }
    ]
  }
] as const;
