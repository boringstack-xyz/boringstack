import { useCallback, useEffect, useState } from "react";

import { subscribeWebPush, unsubscribeWebPush } from "@/lib/api/openapi";
import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import type { IUseWebPushView, IWebPushPermission } from "./useWebPush.types";
import { urlBase64ToUint8Array } from "./useWebPush.utils";

const isApiSupported = (): boolean =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

const currentPermission = (): IWebPushPermission => {
  if (!isApiSupported()) {
    return "default";
  }

  const granted = Notification.permission;

  if (granted === "granted" || granted === "denied") {
    return granted;
  }

  return "default";
};

const normalizePermission = (
  value: NotificationPermission
): IWebPushPermission => {
  if (value === "granted") {
    return "granted";
  }

  if (value === "denied") {
    return "denied";
  }

  return "default";
};

interface ISerializedSubscription {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
  readonly expirationTime: number | null;
}

const serializeSubscription = (
  subscription: PushSubscription
): ISerializedSubscription => {
  const json = subscription.toJSON();

  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? ""
    },
    expirationTime:
      typeof subscription.expirationTime === "number"
        ? subscription.expirationTime
        : null
  };
};

/**
 * Single source of truth for Web Push subscription state on the client.
 * Reads the current `Notification.permission`, the active `PushSubscription`
 * (if any), and the operator's VAPID config; exposes `subscribe()` /
 * `unsubscribe()` that wrap the browser dance + the server round-trip.
 *
 * The hook is best-effort: every failure path is logged + surfaced through
 * `isPending → false`. The Settings page renders state-specific copy
 * ("blocked", "unsupported", "subscribed") off the returned view.
 */
export function useWebPush(): IUseWebPushView {
  const isSupported = isApiSupported();
  const isConfigured = env.VITE_VAPID_PUBLIC_KEY !== "";

  const [permission, setPermission] =
    useState<IWebPushPermission>(currentPermission);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isSupported) {
      return undefined;
    }

    let cancelled = false;

    const refreshSubscription = async (): Promise<void> => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();

        if (!cancelled) {
          setIsSubscribed(sub !== null);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          logger.warn({
            event: "notifications.web_push.subscribe_failed",
            phase: "initial_check",
            error: getErrorMessage(error)
          });
        }
      }
    };

    void refreshSubscription();

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !isConfigured) {
      return;
    }

    setIsPending(true);

    try {
      const requested = await Notification.requestPermission();

      setPermission(normalizePermission(requested));

      if (requested !== "granted") {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      /*
       * The decoder returns a `Uint8Array<ArrayBufferLike>`, but `subscribe`
       * wants an `ArrayBuffer`-backed `BufferSource`. `Uint8Array.from` copies
       * into a fresh `Uint8Array<ArrayBuffer>`, satisfying the strict signature
       * without a type assertion.
       */
      const keyBytes = urlBase64ToUint8Array(env.VITE_VAPID_PUBLIC_KEY);
      const applicationServerKey = Uint8Array.from(keyBytes);
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        }));
      const body = serializeSubscription(subscription);

      await subscribeWebPush({
        endpoint: body.endpoint,
        keys: body.keys,
        expirationTime: body.expirationTime,
        userAgent: navigator.userAgent
      });

      setIsSubscribed(true);
    } catch (error: unknown) {
      logger.warn({
        event: "notifications.web_push.subscribe_failed",
        error: getErrorMessage(error)
      });
    } finally {
      setIsPending(false);
    }
  }, [isSupported, isConfigured]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      return;
    }

    setIsPending(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription === null) {
        setIsSubscribed(false);

        return;
      }

      const endpoint = subscription.endpoint;

      /*
       * Order matters. `subscription.unsubscribe()` flips the browser
       * state irreversibly — there is no `subscription.subscribe()` to
       * roll it back. Once that succeeds the UI is unsubscribed in
       * reality, and `isSubscribed` must reflect that even if the
       * follow-up server DELETE fails (the worker prunes the stale row
       * on the next 410 anyway).
       */
      await subscription.unsubscribe();
      setIsSubscribed(false);

      try {
        await unsubscribeWebPush(endpoint);
      } catch (serverError: unknown) {
        logger.warn({
          event: "notifications.web_push.unsubscribe_failed",
          phase: "server",
          error: getErrorMessage(serverError)
        });
      }
    } catch (error: unknown) {
      logger.warn({
        event: "notifications.web_push.unsubscribe_failed",
        phase: "browser",
        error: getErrorMessage(error)
      });
    } finally {
      setIsPending(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    isConfigured,
    permission,
    isSubscribed,
    isPending,
    subscribe,
    unsubscribe
  };
}
