import type { LucideIcon } from "lucide-react";

/*
 * "outline" leads a call to action, "soft" marks a panel's topic, "danger"
 * heads a destructive confirmation or a failure.
 */
export type IconBadgeTone = "outline" | "soft" | "danger";

export interface IIconBadgeProps {
  readonly icon: LucideIcon;
  readonly tone?: IconBadgeTone;
  readonly className?: string;
}
