import type {
  INotification,
  INotificationPage
} from "../../Notifications.types";

export function flattenPages(
  pages: INotificationPage[] | undefined
): INotification[] {
  if (pages === undefined) {
    return [];
  }

  const out: INotification[] = [];

  for (const page of pages) {
    out.push(...page.items);
  }

  return out;
}
