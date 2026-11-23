import { cn } from "@/lib/classnames";

import { ICON_BADGE_TONE_CLASS_NAMES } from "./IconBadge.constants";
import type { IIconBadgeProps } from "./IconBadge.types";

/** The badge's classes for its tone. */
export function useIconBadge(props: IIconBadgeProps) {
  return {
    className: cn(
      "flex size-10 shrink-0 items-center justify-center",
      ICON_BADGE_TONE_CLASS_NAMES[props.tone ?? "outline"],
      props.className
    )
  };
}
