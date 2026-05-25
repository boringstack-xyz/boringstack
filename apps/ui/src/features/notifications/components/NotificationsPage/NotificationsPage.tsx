import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { NotificationListItem } from "../NotificationListItem";
import { NOTIFICATIONS_PAGE_TABS } from "./NotificationsPage.constants";
import { useNotificationsPage } from "./NotificationsPage.hooks";

const NotificationsPage: FC = () => {
  const { t } = useTranslation();
  const {
    items,
    status,
    onTabChange,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    onMarkRead,
    onArchive,
    onMarkAllRead,
    isMarkingAllRead,
    isEmpty
  } = useNotificationsPage();

  const currentTabValue = status ?? "all";

  const renderedTriggers = NOTIFICATIONS_PAGE_TABS.map((tab) => (
    <TabsTrigger key={tab.value} value={tab.value}>
      {t(tab.labelKey)}
    </TabsTrigger>
  ));

  const renderedItems = items.map((item) => (
    <NotificationListItem
      key={item.id}
      notification={item}
      onMarkRead={onMarkRead}
      onArchive={onArchive}
    />
  ));

  const renderedTabContents = NOTIFICATIONS_PAGE_TABS.map((tab) => (
    <TabsContent
      key={tab.value}
      value={tab.value}
      className='border-border bg-background mt-6 overflow-hidden rounded-2xl border'
    >
      {isLoading ? (
        <p className='text-muted-foreground p-6 text-sm'>
          {t("notifications.loading")}
        </p>
      ) : null}

      {isEmpty ? (
        <p className='text-muted-foreground p-6 text-sm'>
          {t("notifications.empty")}
        </p>
      ) : null}

      {renderedItems}

      {hasNextPage ? (
        <div className='border-border flex justify-center border-t p-4'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={fetchNextPage}
            disabled={isFetchingNextPage}
          >
            {t("notifications.loadMore")}
          </Button>
        </div>
      ) : null}
    </TabsContent>
  ));

  return (
    <AppPage
      pageTitle={t("notifications.title")}
      title={t("notifications.title")}
      actions={
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onMarkAllRead}
          disabled={isMarkingAllRead}
        >
          {t("notifications.markAllAsRead")}
        </Button>
      }
    >
      <Tabs value={currentTabValue} onValueChange={onTabChange}>
        <TabsList>{renderedTriggers}</TabsList>
        {renderedTabContents}
      </Tabs>
    </AppPage>
  );
};

NotificationsPage.displayName = "NotificationsPage";

export default NotificationsPage;
export { NotificationsPage };
