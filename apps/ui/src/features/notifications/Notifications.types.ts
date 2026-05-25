import type { operations } from "@/lib/api/client";

type ListResponse =
  operations["getApiV1Notifications"]["responses"][200]["content"]["application/json"];

type PreferencesResponse =
  operations["getApiV1NotificationsPreferences"]["responses"][200]["content"]["application/json"];

export type INotificationPage = ListResponse;
export type INotification = ListResponse["items"][number];
export type INotificationStatus = INotification["status"];

export type INotificationPreference = PreferencesResponse["items"][number];

export type INotificationListStatus = "unread" | "read" | "archived";

export interface INotificationStreamMessage {
  readonly type: "notification.created";
  readonly notification: INotification;
}

export interface IInfiniteCache {
  pages: INotificationPage[];
  pageParams: unknown[];
}

export type IListSnapshots = [readonly unknown[], IInfiniteCache | undefined][];

export interface IStatusContext {
  readonly snapshots: IListSnapshots;
}

export interface IMarkAllReadContext {
  readonly snapshots: IListSnapshots;
  readonly unreadSnapshot: number | undefined;
}

export interface IPreferencesContext {
  readonly snapshot: INotificationPreference[] | undefined;
}
