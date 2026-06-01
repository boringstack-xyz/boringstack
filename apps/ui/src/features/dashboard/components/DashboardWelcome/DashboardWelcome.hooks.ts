import { useTranslation } from "react-i18next";

import { DASHBOARD_WELCOME_DISPLAY_NAME_FALLBACK_KEY } from "./DashboardWelcome.constants";
import type {
  IDashboardWelcomeProps,
  IDashboardWelcomeView
} from "./DashboardWelcome.types";

export function useDashboardWelcome(
  props: IDashboardWelcomeProps
): IDashboardWelcomeView {
  const { t } = useTranslation();
  const normalizedDisplayName = props.displayName?.trim() ?? "";
  const safeDisplayName =
    normalizedDisplayName !== ""
      ? normalizedDisplayName
      : t(DASHBOARD_WELCOME_DISPLAY_NAME_FALLBACK_KEY);

  const sublineKey = props.hasActionItems
    ? "dashboard.welcome.subline.setup"
    : "dashboard.welcome.subline.ready";

  return {
    className: props.className,
    eyebrow: t("dashboard.welcome.eyebrow"),
    title: t("dashboard.welcome.title", { displayName: safeDisplayName }),
    subline: t(sublineKey)
  };
}
