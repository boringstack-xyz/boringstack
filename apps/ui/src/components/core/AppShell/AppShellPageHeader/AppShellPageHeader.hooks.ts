import { cn } from "@/lib/classnames";

import {
  APP_PAGE_SHELL_EYEBROW_CLASS_NAME,
  APP_PAGE_SHELL_SUBTITLE_CLASS_NAME,
  APP_PAGE_SHELL_TITLE_CLASS_NAME
} from "@/components/core/AppPage";

import type { IAppShellPageHeaderProps } from "./AppShellPageHeader.types";

/** The classes of each line of the header block. */
export function useAppShellPageHeader(props: IAppShellPageHeaderProps) {
  return {
    className: cn("min-w-0", props.className),
    eyebrowClassName: APP_PAGE_SHELL_EYEBROW_CLASS_NAME,
    titleClassName: APP_PAGE_SHELL_TITLE_CLASS_NAME,
    subtitleClassName: APP_PAGE_SHELL_SUBTITLE_CLASS_NAME
  };
}
