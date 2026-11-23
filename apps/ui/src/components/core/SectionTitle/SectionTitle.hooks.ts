import { cn } from "@/lib/classnames";

import type {
  ISectionTitleProps,
  ISectionTitleView
} from "./SectionTitle.types";

/** Which heading level the title takes, and the wrapper's classes. */
export function useSectionTitle(props: ISectionTitleProps): ISectionTitleView {
  return {
    isSubsection: props.level === 3,
    className: cn("flex flex-col gap-1", props.className)
  };
}
