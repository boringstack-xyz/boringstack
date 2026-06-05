import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import type { INotificationStreamMessage } from "./Notifications.types";

/*
 * Trailing-slash strip matches the openapi-fetch BASE_URL pattern in
 * `apps/ui/src/lib/api/openapi.ts` so a `VITE_API_URL` ending in `/`
 * doesn't produce a `//api/v1/...` path (Traefik and nginx reject the
 * double-slash as a redirect loop).
 */
export function buildStreamUrl(): string {
  return `${env.VITE_API_URL.replace(/\/$/, "")}/api/v1/notifications/stream`;
}

/*
 * Cast-free narrowing: `in` + `typeof` checks let TypeScript prove the shape,
 * so the type predicate returns the narrowed type with no `as` assertion. The
 * id check is the field the cache keys on (Notifications.utils dedupes by id).
 */
function isStreamMessage(value: unknown): value is INotificationStreamMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("type" in value) || value.type !== "notification.created") {
    return false;
  }

  if (!("notification" in value)) {
    return false;
  }

  const notification = value.notification;

  return (
    typeof notification === "object" &&
    notification !== null &&
    "id" in notification &&
    typeof notification.id === "string"
  );
}

export function parseStreamMessage(
  raw: string
): INotificationStreamMessage | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);

    return isStreamMessage(parsed) ? parsed : undefined;
  } catch (error) {
    logger.warn({
      event: "notifications.stream.parse_failed",
      error: getErrorMessage(error)
    });

    return undefined;
  }
}
