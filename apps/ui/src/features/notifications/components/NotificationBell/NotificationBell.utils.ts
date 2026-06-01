import { NOTIFICATION_BELL_BADGE_CAP } from "./NotificationBell.constants";

export function formatBadgeCount(count: number): string {
  if (count > NOTIFICATION_BELL_BADGE_CAP) {
    return `${String(NOTIFICATION_BELL_BADGE_CAP)}+`;
  }

  return String(count);
}
