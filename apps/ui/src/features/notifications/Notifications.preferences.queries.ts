import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import { NOTIFICATIONS_QUERY_KEYS } from "./Notifications.constants";
import type {
  INotificationPreference,
  IPreferencesContext
} from "./Notifications.types";

export function useNotificationPreferences(): UseQueryResult<
  INotificationPreference[]
> {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEYS.preferences,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/notifications/preferences");

      if (!data) {
        throw new Error("Empty preferences response");
      }

      return data.items;
    }
  });
}

export function useUpdateNotificationPreferences(): UseMutationResult<
  INotificationPreference[],
  unknown,
  INotificationPreference[],
  IPreferencesContext
> {
  const qc = useQueryClient();

  return useMutation<
    INotificationPreference[],
    unknown,
    INotificationPreference[],
    IPreferencesContext
  >({
    mutationFn: async (preferences) => {
      const { data } = await apiClient.PUT(
        "/api/v1/notifications/preferences",
        { body: { preferences } }
      );

      if (!data) {
        throw new Error("Empty preferences update response");
      }

      return data.items;
    },
    onMutate: async (preferences) => {
      await qc.cancelQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.preferences
      });

      const snapshot = qc.getQueryData<INotificationPreference[]>(
        NOTIFICATIONS_QUERY_KEYS.preferences
      );

      qc.setQueryData(NOTIFICATIONS_QUERY_KEYS.preferences, preferences);

      return { snapshot };
    },
    onSuccess: (items) => {
      qc.setQueryData(NOTIFICATIONS_QUERY_KEYS.preferences, items);
    },
    onError: (error, _vars, context) => {
      logger.warn({
        event: "notifications.update_preferences_failed",
        error: getErrorMessage(error)
      });

      if (context !== undefined) {
        qc.setQueryData(NOTIFICATIONS_QUERY_KEYS.preferences, context.snapshot);
      }
    }
  });
}
