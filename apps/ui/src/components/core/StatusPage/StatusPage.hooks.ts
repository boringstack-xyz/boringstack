import { useTranslation } from "react-i18next";

import type { IStatusPageProps } from "./StatusPage.types";

/** The tab title, in the app's "Page · App name" form. */
export function useStatusPage(props: Pick<IStatusPageProps, "metaTitle">) {
  const { t } = useTranslation();

  return { documentTitle: `${props.metaTitle} · ${t("app.name")}` };
}
