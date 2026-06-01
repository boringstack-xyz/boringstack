import { NOTIFICATION_LIST_ITEM_BODY_PREVIEW_LENGTH } from "./NotificationListItem.constants";

export function previewBody(body: string): string {
  if (body.length <= NOTIFICATION_LIST_ITEM_BODY_PREVIEW_LENGTH) {
    return body;
  }

  return `${body.slice(0, NOTIFICATION_LIST_ITEM_BODY_PREVIEW_LENGTH).trimEnd()}…`;
}
