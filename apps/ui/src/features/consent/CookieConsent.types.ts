export type CookieConsentStatus = "unset" | "configured";

export interface ICookieConsentCategories {
  /**
   * Strictly necessary cookies — auth, CSRF, session, language preference.
   * Always true; the toggle is shown as locked-on in the configure modal
   * so the user can see what's actually required.
   */
  readonly essential: true;
  /**
   * First-party product analytics (page views, feature usage). NEVER set
   * to true without explicit user consent — defaults to false so the
   * banner-default behaviour is GDPR-friendly out of the box.
   */
  readonly analytics: boolean;
  /**
   * Marketing / cross-site identifiers. Same default-off rule as
   * analytics. Most starter forks won't use this category; it ships off
   * by default and the UI lets you remove the row entirely.
   */
  readonly marketing: boolean;
}

export interface ICookieConsentState {
  readonly status: CookieConsentStatus;
  readonly categories: ICookieConsentCategories;
  readonly configuredAt: string | null;
}
