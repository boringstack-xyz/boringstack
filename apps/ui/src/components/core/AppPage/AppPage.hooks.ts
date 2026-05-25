import { useLayoutEffect } from "react";

import { useTranslation } from "react-i18next";

import type { IAppPageHeaderState, IAppPageProps } from "./AppPage.types";
import { useAppPageHeaderContext } from "./AppPageHeader.hooks";

export function useAppPage(
  props: Pick<
    IAppPageProps,
    "actions" | "eyebrow" | "pageTitle" | "subtitle" | "title"
  >
): { readonly documentTitle: string } {
  const { t } = useTranslation();
  const setHeader = useAppPageHeaderContext()?.setHeader;

  useLayoutEffect(() => {
    if (setHeader === undefined) {
      return undefined;
    }

    const nextHeader: IAppPageHeaderState = {
      title: props.title ?? props.pageTitle,
      subtitle: props.subtitle,
      eyebrow: props.eyebrow,
      actions: props.actions
    };

    setHeader(nextHeader);

    return () => {
      setHeader(null);
    };
  }, [
    props.actions,
    props.eyebrow,
    props.pageTitle,
    props.subtitle,
    props.title,
    setHeader
  ]);

  return {
    documentTitle: `${props.pageTitle} · ${t("app.name")}`
  };
}
