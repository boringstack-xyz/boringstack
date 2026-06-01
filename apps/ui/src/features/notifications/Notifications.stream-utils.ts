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

export function parseStreamMessage(
  raw: string
): INotificationStreamMessage | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    const record = parsed as Record<string, unknown>;

    if (
      record.type !== "notification.created" ||
      typeof record.notification !== "object" ||
      record.notification === null
    ) {
      return undefined;
    }

    return parsed as INotificationStreamMessage;
  } catch (error) {
    logger.warn({
      event: "notifications.stream.parse_failed",
      error: getErrorMessage(error)
    });

    return undefined;
  }
}
