import type { ICookieConsentCategories } from "../CookieConsent.types";

export interface ICookieConsentBannerView {
  readonly isVisible: boolean;
  readonly isConfigureOpen: boolean;
  readonly draftCategories: ICookieConsentCategories;
  readonly acceptAll: () => void;
  readonly rejectNonEssential: () => void;
  readonly openConfigure: () => void;
  readonly closeConfigure: () => void;
  readonly toggleDraftCategory: (
    category: keyof ICookieConsentCategories,
    enabled: boolean
  ) => void;
  readonly saveConfigure: () => void;
  readonly handleConfigureChange: (open: boolean) => void;
  readonly handleAnalyticsChange: (enabled: boolean) => void;
  readonly handleMarketingChange: (enabled: boolean) => void;
}
