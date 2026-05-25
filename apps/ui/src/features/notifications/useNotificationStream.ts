import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { performRefresh } from "@/lib/api/openapi";
import { logger } from "@/lib/logger/logger";

import { useMe } from "@/features/auth/Auth.queries";

import { NOTIFICATION_STREAM_MAX_RECONNECTS } from "./Notifications.constants";
import {
  buildStreamUrl,
  parseStreamMessage
} from "./Notifications.stream-utils";
import type { INotification } from "./Notifications.types";
import { mergeStreamNotificationIntoCache } from "./Notifications.utils";

export function useNotificationStream(enabled = true): void {
  const qc = useQueryClient();
  const me = useMe();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const userId = me.data?.user.id;

  useEffect(() => {
    if (userId === undefined || !enabled) {
      return undefined;
    }

    let source: EventSource | null = null;
    let closed = false;
    let reconnects = 0;

    const open = (): void => {
      if (closed) {
        return;
      }

      source = new EventSource(buildStreamUrl(), { withCredentials: true });

      source.onopen = (): void => {
        reconnects = 0;
      };

      source.onmessage = (event: MessageEvent<string>): void => {
        const message = parseStreamMessage(event.data);

        if (message === undefined) {
          return;
        }

        const notification: INotification = message.notification;

        mergeStreamNotificationIntoCache(qc, notification);

        const ctaUrl = notification.ctaUrl;
        const ctaLabel = notification.ctaLabel ?? t("notifications.openCta");

        toast(notification.title, {
          description: notification.body,
          action:
            ctaUrl !== null
              ? {
                  label: ctaLabel,
                  onClick: () => {
                    void navigate(ctaUrl);
                  }
                }
              : undefined
        });
      };

      source.onerror = (): void => {
        if (closed) {
          return;
        }

        source?.close();
        source = null;

        if (reconnects >= NOTIFICATION_STREAM_MAX_RECONNECTS) {
          logger.warn({
            event: "notifications.stream.gave_up",
            reconnects
          });

          return;
        }

        reconnects += 1;
        logger.warn({
          event: "notifications.stream.errored",
          reconnects
        });

        void performRefresh().then((ok) => {
          if (closed) {
            return;
          }

          if (!ok) {
            logger.warn({ event: "notifications.stream.refresh_failed" });

            return;
          }

          open();
        });
      };
    };

    open();

    return (): void => {
      closed = true;
      source?.close();
    };
  }, [userId, enabled, qc, navigate, t]);
}
