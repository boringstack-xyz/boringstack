import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from "../../Notifications.preferences.queries";
import { PREFERENCE_CHANNEL_COLUMNS } from "./NotificationsPreferencesPage.constants";
import type {
  INotificationsPreferencesPageView,
  IPreferenceRow
} from "./NotificationsPreferencesPage.types";
import {
  groupByEventType,
  rowsToPreferences,
  toggleChannel
} from "./NotificationsPreferencesPage.utils";

export function useNotificationsPreferencesPage(): INotificationsPreferencesPageView {
  const { t } = useTranslation();
  const query = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const [rows, setRows] = useState<IPreferenceRow[]>([]);

  useEffect(() => {
    if (query.data !== undefined) {
      setRows(groupByEventType(query.data));
    }
  }, [query.data]);

  const toggle = useCallback((eventType: string, channel: string): void => {
    setRows((current) => toggleChannel(current, eventType, channel));
  }, []);

  const save = useCallback((): void => {
    update.mutate(rowsToPreferences(rows), {
      onSuccess: () => {
        toast.success(t("notifications.preferences.saved"));
      }
    });
  }, [rows, update, t]);

  return {
    rows,
    channels: PREFERENCE_CHANNEL_COLUMNS,
    isLoading: query.isPending,
    isError: query.isError,
    isEmpty: !query.isPending && rows.length === 0,
    isSaving: update.isPending,
    toggle,
    save,
    preferences: query.data ?? []
  };
}
