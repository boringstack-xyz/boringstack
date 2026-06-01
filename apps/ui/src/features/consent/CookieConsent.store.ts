import { create } from "zustand";
import { persist } from "zustand/middleware";

import { now } from "@/lib/time/now";

import type {
  ICookieConsentCategories,
  ICookieConsentState
} from "./CookieConsent.types";

const STORAGE_KEY = "bs.cookie-consent.v1";

const ESSENTIAL_ONLY: ICookieConsentCategories = {
  essential: true,
  analytics: false,
  marketing: false
};

const ACCEPT_ALL: ICookieConsentCategories = {
  essential: true,
  analytics: true,
  marketing: true
};

export interface ICookieConsentStore extends ICookieConsentState {
  readonly acceptAll: () => void;
  readonly rejectNonEssential: () => void;
  readonly setCategories: (next: Partial<ICookieConsentCategories>) => void;
  readonly reset: () => void;
}

/**
 * Why a custom store instead of pulling in cookiebot / iubenda /
 * similar: vendor banners are heavyweight (300-700 KB blocking JS,
 * external network calls before consent is granted — itself a
 * regulatory grey area), they require a per-domain account, and they
 * can't be lint-gated. A 100-line store + a banner component does the
 * same job at ~2 KB without sending anything to a third party.
 *
 * Persisted to localStorage so a returning user sees no banner. The
 * timestamp is recorded for compliance audits ("when did this user
 * consent?"). The key is versioned (`.v1`) so a future model change
 * can re-prompt without leaving stale values.
 */
export const useCookieConsentStore = create<ICookieConsentStore>()(
  persist(
    (set) => ({
      status: "unset",
      categories: ESSENTIAL_ONLY,
      configuredAt: null,
      acceptAll: () => {
        set({
          status: "configured",
          categories: ACCEPT_ALL,
          configuredAt: now()
        });
      },
      rejectNonEssential: () => {
        set({
          status: "configured",
          categories: ESSENTIAL_ONLY,
          configuredAt: now()
        });
      },
      setCategories: (next) => {
        set((current) => ({
          status: "configured",
          categories: {
            essential: true,
            analytics: next.analytics ?? current.categories.analytics,
            marketing: next.marketing ?? current.categories.marketing
          },
          configuredAt: now()
        }));
      },
      reset: () => {
        set({
          status: "unset",
          categories: ESSENTIAL_ONLY,
          configuredAt: null
        });
      }
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        status: state.status,
        categories: state.categories,
        configuredAt: state.configuredAt
      })
    }
  )
);

/**
 * Read-only helper: returns true when the user has explicitly granted
 * the given category. Defaults to false (consent is opt-in, not
 * opt-out) so callers can safely gate analytics / marketing scripts on
 * this without leaking before the banner is dismissed.
 */
export const useIsConsentCategoryEnabled = (
  category: keyof ICookieConsentCategories
): boolean =>
  useCookieConsentStore((state) => {
    if (state.status !== "configured") {
      return false;
    }

    const value = state.categories[category];

    return value;
  });
