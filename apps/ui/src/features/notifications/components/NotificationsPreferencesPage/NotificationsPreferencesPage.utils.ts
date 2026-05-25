import type { INotificationPreference } from "../../Notifications.types";
import type { IPreferenceRow } from "./NotificationsPreferencesPage.types";

export function channelHeaderKey(channel: string): string {
  if (channel === "in-app") {
    return "notifications.preferences.columns.inApp";
  }

  if (channel === "web-push") {
    return "notifications.preferences.columns.webPush";
  }

  return "notifications.preferences.columns.email";
}

export function groupByEventType(
  preferences: INotificationPreference[]
): IPreferenceRow[] {
  const grouped = new Map<string, Record<string, boolean>>();

  for (const pref of preferences) {
    const existing = grouped.get(pref.eventType) ?? {};

    existing[pref.channel] = pref.enabled;
    grouped.set(pref.eventType, existing);
  }

  const rows: IPreferenceRow[] = [];

  for (const [eventType, channels] of grouped.entries()) {
    rows.push({ eventType, channels });
  }

  rows.sort((a, b) => a.eventType.localeCompare(b.eventType));

  return rows;
}

export function rowsToPreferences(
  rows: IPreferenceRow[]
): INotificationPreference[] {
  const out: INotificationPreference[] = [];

  for (const row of rows) {
    for (const [channel, enabled] of Object.entries(row.channels)) {
      out.push({ eventType: row.eventType, channel, enabled });
    }
  }

  return out;
}

export function toggleChannel(
  rows: IPreferenceRow[],
  eventType: string,
  channel: string
): IPreferenceRow[] {
  return rows.map((row) =>
    row.eventType === eventType
      ? {
          ...row,
          channels: { ...row.channels, [channel]: !row.channels[channel] }
        }
      : row
  );
}
