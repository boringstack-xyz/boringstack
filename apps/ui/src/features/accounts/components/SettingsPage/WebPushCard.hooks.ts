import { useCallback } from "react";

import { useTranslation } from "react-i18next";

import { useCapabilities } from "@/lib/api/queries/useCapabilities";

import { useWebPush } from "@/hooks/useWebPush.hooks";

import type { IWebPushCardView } from "./WebPushCard.types";

/**
 * Maps the Web Push hook state machine into a single view-object for the
 * Settings page card. The card always renders — the state label changes
 * with what's actually possible:
 *
 *   unsupported    → "This browser doesn't support Web Push." (no button)
 *   notConfigured  → "Web Push is not configured." (no button)
 *   blocked        → "Your browser is blocking notifications." (no button)
 *   notSubscribed  → "Notifications are off." + [Subscribe] button
 *   subscribed     → "You're subscribed." + [Unsubscribe] button
 */
export function useWebPushCard(): IWebPushCardView {
  const { t } = useTranslation();
  const capabilities = useCapabilities();
  const serverWebPushEnabled =
    capabilities.data?.features.notifications.webPush === true;
  const {
    isSupported,
    isConfigured: hasLocalVapidKey,
    permission,
    isSubscribed,
    isPending,
    subscribe,
    unsubscribe
  } = useWebPush();
  const isConfigured = hasLocalVapidKey && serverWebPushEnabled;

  const noop = useCallback((): void => undefined, []);

  if (!isSupported) {
    return {
      title: t("accounts.settings.sections.webPush.title"),
      body: t("accounts.settings.sections.webPush.body"),
      stateLabel: t("accounts.settings.sections.webPush.stateUnsupported"),
      buttonLabel: "",
      onAction: noop,
      canAct: false,
      isPending: false
    };
  }

  if (!isConfigured) {
    return {
      title: t("accounts.settings.sections.webPush.title"),
      body: t("accounts.settings.sections.webPush.body"),
      stateLabel: t("accounts.settings.sections.webPush.stateNotConfigured"),
      buttonLabel: "",
      onAction: noop,
      canAct: false,
      isPending: false
    };
  }

  if (permission === "denied") {
    return {
      title: t("accounts.settings.sections.webPush.title"),
      body: t("accounts.settings.sections.webPush.body"),
      stateLabel: t("accounts.settings.sections.webPush.stateBlocked"),
      buttonLabel: "",
      onAction: noop,
      canAct: false,
      isPending: false
    };
  }

  if (isSubscribed) {
    return {
      title: t("accounts.settings.sections.webPush.title"),
      body: t("accounts.settings.sections.webPush.body"),
      stateLabel: t("accounts.settings.sections.webPush.stateSubscribed"),
      buttonLabel: isPending
        ? t("accounts.settings.sections.webPush.pending")
        : t("accounts.settings.sections.webPush.unsubscribe"),
      onAction: () => {
        void unsubscribe();
      },
      canAct: true,
      isPending
    };
  }

  return {
    title: t("accounts.settings.sections.webPush.title"),
    body: t("accounts.settings.sections.webPush.body"),
    stateLabel: t("accounts.settings.sections.webPush.stateNotSubscribed"),
    buttonLabel: isPending
      ? t("accounts.settings.sections.webPush.pending")
      : t("accounts.settings.sections.webPush.subscribe"),
    onAction: () => {
      void subscribe();
    },
    canAct: true,
    isPending
  };
}
