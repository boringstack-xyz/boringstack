import { useEffect } from "react";

import * as Sentry from "@sentry/react";

import { useMe } from "@/features/auth/Auth.queries";

/*
 * Syncs the current /me identity into the Sentry SDK's user context so
 * any error captured by Sentry/GlitchTip is tagged with the actual user
 * (id + email). The matching `Sentry.setUser()` on the API side
 * (auth.plugin.ts) gives the same correlation on the server, so a
 * browser-side exception and the upstream API error appear under the
 * same user.id in GlitchTip.
 *
 * Mounted as a sibling of AbilityProvider in App.tsx. No UI; purely a
 * side-effect on every change to the current-user query result.
 *
 * No-op when VITE_SENTRY_DSN is empty — Sentry.init didn't run, the
 * setUser call is a noop. Logout sets the user to null so subsequent
 * unauthenticated errors aren't attributed to the last signed-in user.
 */
export const SentryUserSync = (): null => {
  const me = useMe();
  const userId = me.data?.user.id;
  const userEmail = me.data?.user.email;

  useEffect(() => {
    if (userId !== undefined && userEmail !== undefined) {
      Sentry.setUser({ id: userId, email: userEmail });

      return;
    }

    Sentry.setUser(null);
  }, [userId, userEmail]);

  return null;
};
