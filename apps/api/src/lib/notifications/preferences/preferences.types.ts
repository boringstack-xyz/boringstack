export interface INotificationPreferenceRow {
  eventType: string;
  channel: string;
  enabled: boolean;
}

export interface IUpdatePreferenceInput {
  eventType: string;
  channel: string;
  enabled: boolean;
}

export interface IPreferenceResolutionResult {
  enabled: readonly string[];
  disabled: readonly string[];
}
