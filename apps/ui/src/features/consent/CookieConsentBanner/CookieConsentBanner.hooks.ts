import { useCallback, useRef, useState } from "react";

import { useCookieConsentStore } from "../CookieConsent.store";
import type { ICookieConsentCategories } from "../CookieConsent.types";
import type { ICookieConsentBannerView } from "./CookieConsentBanner.types";

export function useCookieConsentBanner(): ICookieConsentBannerView {
  const status = useCookieConsentStore((s) => s.status);
  const categories = useCookieConsentStore((s) => s.categories);
  const acceptAllAction = useCookieConsentStore((s) => s.acceptAll);
  const rejectAction = useCookieConsentStore((s) => s.rejectNonEssential);
  const setCategoriesAction = useCookieConsentStore((s) => s.setCategories);

  const [isConfigureOpen, setConfigureOpen] = useState<boolean>(false);
  const [draftCategories, setDraftCategories] =
    useState<ICookieConsentCategories>(categories);

  /*
   * Mirror draftCategories into a ref so saveConfigure can be a stable
   * callback that reads the latest value, even when openConfigure +
   * toggleDraftCategory + saveConfigure are called in the same React
   * batch — the closure-over-state pattern would otherwise see the
   * pre-toggle draft.
   */
  const draftRef = useRef(draftCategories);

  draftRef.current = draftCategories;

  const openConfigure = useCallback((): void => {
    setDraftCategories(categories);
    draftRef.current = categories;
    setConfigureOpen(true);
  }, [categories]);

  const closeConfigure = useCallback((): void => {
    setConfigureOpen(false);
  }, []);

  const toggleDraftCategory = useCallback(
    (category: keyof ICookieConsentCategories, enabled: boolean): void => {
      if (category === "essential") {
        return;
      }

      const next = { ...draftRef.current, [category]: enabled };

      draftRef.current = next;
      setDraftCategories(next);
    },
    []
  );

  const saveConfigure = useCallback((): void => {
    setCategoriesAction({
      analytics: draftRef.current.analytics,
      marketing: draftRef.current.marketing
    });
    setConfigureOpen(false);
  }, [setCategoriesAction]);

  const handleConfigureChange = useCallback(
    (open: boolean): void => {
      if (!open) {
        closeConfigure();
      }
    },
    [closeConfigure]
  );

  const handleAnalyticsChange = useCallback(
    (enabled: boolean): void => {
      toggleDraftCategory("analytics", enabled);
    },
    [toggleDraftCategory]
  );

  const handleMarketingChange = useCallback(
    (enabled: boolean): void => {
      toggleDraftCategory("marketing", enabled);
    },
    [toggleDraftCategory]
  );

  return {
    isVisible: status === "unset",
    isConfigureOpen,
    draftCategories,
    acceptAll: acceptAllAction,
    rejectNonEssential: rejectAction,
    openConfigure,
    closeConfigure,
    toggleDraftCategory,
    saveConfigure,
    handleConfigureChange,
    handleAnalyticsChange,
    handleMarketingChange
  };
}
