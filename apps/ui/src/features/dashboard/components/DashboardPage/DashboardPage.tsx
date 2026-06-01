import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { AppPage } from "@/components/core/AppPage";

import { ActivityFeed } from "../ActivityFeed";
import { DashboardActionItems } from "../DashboardActionItems";
import { useDashboardActionItems } from "../DashboardActionItems/DashboardActionItems.hooks";
import { useDashboardWelcome } from "../DashboardWelcome/DashboardWelcome.hooks";
import { useDashboardPage } from "./DashboardPage.hooks";
import { StatsSection } from "./StatsSection";

const DashboardPage: FC = () => {
  const { t } = useTranslation();
  const { summary, isLoading, displayName } = useDashboardPage();
  const { items: actionItems } = useDashboardActionItems({});
  const welcome = useDashboardWelcome({
    displayName,
    hasActionItems: actionItems.length > 0
  });

  return (
    <AppPage
      pageTitle={t("dashboard.title")}
      title={welcome.title}
      subtitle={welcome.subline}
      eyebrow={welcome.eyebrow}
    >
      <DashboardActionItems />

      <StatsSection isLoading={isLoading} summary={summary} t={t} />

      <ActivityFeed />
    </AppPage>
  );
};

DashboardPage.displayName = "DashboardPage";

export default DashboardPage;
export { DashboardPage };
