import type * as AnalyticsModule from "./analytics.service";

type TAnalyticsModule = typeof AnalyticsModule;

/*
 * The analytics module is fetched only once the visitor first accepts analytics,
 * so the entry bundle carries none of it. Until then this gate does nothing.
 */
let loaded: Promise<TAnalyticsModule> | undefined;

function analyticsModule(): Promise<TAnalyticsModule> {
  loaded ??= import("./analytics.service");

  return loaded;
}

/** Applies the visitor's analytics choice. Withdrawing before any acceptance is a no-op. */
export function applyAnalyticsConsent(granted: boolean): void {
  if (!granted && loaded === undefined) {
    return;
  }

  void analyticsModule().then((analytics) => {
    analytics.setAnalyticsConsent(granted);

    if (granted) {
      analytics.trackPage(window.location.pathname);
    }
  });
}

/** Counts a navigation. Nothing loads before consent, so nothing is counted either. */
export function trackRouteView(pathname: string): void {
  if (loaded === undefined) {
    return;
  }

  void loaded.then((analytics) => {
    analytics.trackPage(pathname);
  });
}
