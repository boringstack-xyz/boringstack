import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { PAGE_LOADING_FADE_CLASS_NAME } from "./PageLoading.constants";
import type { IPageLoadingProps } from "./PageLoading.types";

/** The title to show and how much room the wait takes. */
export function usePageLoading(props: IPageLoadingProps) {
  const { t } = useTranslation();

  return {
    title: props.title ?? t("common.loading"),
    className: cn(
      "flex items-center justify-center px-4",
      PAGE_LOADING_FADE_CLASS_NAME,
      props.fullScreen === false ? "h-full min-h-48 w-full" : "min-h-screen"
    )
  };
}
