import { useEffect } from "react";

import { applyAnalyticsConsent } from "@/lib/privacy/analytics.consent";

import { useIsConsentCategoryEnabled } from "@/features/consent";

/*
 * Follows the cookie banner's analytics choice. Accepting loads GA4 and counts
 * the page being viewed; withdrawing stops collection and clears GA's cookies.
 * Page views after the first are sent by the router (see app/router/routes.tsx).
 *
 * Mounted beside the cookie banner in App.tsx. No UI.
 */
export const AnalyticsProvider = (): null => {
  const granted = useIsConsentCategoryEnabled("analytics");

  useEffect(() => {
    applyAnalyticsConsent(granted);
  }, [granted]);

  return null;
};
