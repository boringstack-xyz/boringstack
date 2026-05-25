import type { INotificationPreference } from "../../Notifications.types";

export interface IPreferenceRow {
  readonly eventType: string;
  readonly channels: Record<string, boolean>;
}

export interface INotificationsPreferencesPageView {
  readonly rows: IPreferenceRow[];
  readonly channels: readonly string[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly isEmpty: boolean;
  readonly isSaving: boolean;
  readonly toggle: (eventType: string, channel: string) => void;
  readonly save: () => void;
  readonly preferences: INotificationPreference[];
}
