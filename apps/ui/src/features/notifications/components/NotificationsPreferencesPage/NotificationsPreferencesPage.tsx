import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";

import { PreferenceRow } from "../PreferenceRow";
import { useNotificationsPreferencesPage } from "./NotificationsPreferencesPage.hooks";
import { channelHeaderKey } from "./NotificationsPreferencesPage.utils";

const NotificationsPreferencesPage: FC = () => {
  const { t } = useTranslation();
  const {
    rows,
    channels,
    isLoading,
    isError,
    isEmpty,
    isSaving,
    toggle,
    save
  } = useNotificationsPreferencesPage();

  const messageRow = (() => {
    if (isLoading) {
      return t("notifications.loading");
    }

    if (isError) {
      return t("notifications.loadError");
    }

    if (isEmpty) {
      return t("notifications.preferences.empty");
    }

    return null;
  })();

  const totalColumns = channels.length + 1;

  const renderedHeaders = channels.map((channel) => (
    <th
      key={channel}
      className='px-4 py-3 text-center text-xs font-medium tracking-[0.18em] uppercase'
    >
      {t(channelHeaderKey(channel))}
    </th>
  ));

  const renderedRows = rows.map((row) => (
    <PreferenceRow
      key={row.eventType}
      row={row}
      channels={channels}
      onToggle={toggle}
    />
  ));

  return (
    <AppPage
      pageTitle={t("notifications.preferences.title")}
      title={t("notifications.preferences.title")}
      subtitle={t("notifications.preferences.subtitle")}
    >
      <div className='border-border bg-background overflow-hidden rounded-2xl border'>
        <table className='text-foreground w-full text-sm'>
          <thead className='text-muted-foreground border-border border-b'>
            <tr>
              <th className='px-4 py-3 text-left text-xs font-medium tracking-[0.18em] uppercase'>
                {t("notifications.preferences.columns.event")}
              </th>
              {renderedHeaders}
            </tr>
          </thead>
          <tbody>
            {messageRow !== null ? (
              <tr>
                <td
                  colSpan={totalColumns}
                  className='text-muted-foreground px-4 py-8 text-center text-sm'
                >
                  {messageRow}
                </td>
              </tr>
            ) : null}

            {renderedRows}
          </tbody>
        </table>
      </div>

      <div className='flex justify-end'>
        <Button type='button' onClick={save} disabled={isSaving}>
          {t("notifications.preferences.save")}
        </Button>
      </div>
    </AppPage>
  );
};

NotificationsPreferencesPage.displayName = "NotificationsPreferencesPage";

export default NotificationsPreferencesPage;
export { NotificationsPreferencesPage };
