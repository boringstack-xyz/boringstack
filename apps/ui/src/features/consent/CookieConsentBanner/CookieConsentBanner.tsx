import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

import { useCookieConsentBanner } from "./CookieConsentBanner.hooks";

const CookieConsentBanner: FC = () => {
  const { t } = useTranslation();
  const view = useCookieConsentBanner();

  if (!view.isVisible && !view.isConfigureOpen) {
    return null;
  }

  return (
    <>
      {view.isVisible ? (
        <div
          role='region'
          aria-label={t("consent.banner.ariaLabel")}
          className='border-border-strong/40 bg-panel fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border p-6 shadow-2xl sm:flex-row sm:items-center'
        >
          <div className='flex min-w-0 flex-col gap-2'>
            <p className='text-foreground text-base font-semibold tracking-tight'>
              {t("consent.banner.title")}
            </p>
            <p className='text-muted-foreground text-sm'>
              {t("consent.banner.body")}
            </p>
          </div>
          <div className='flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center'>
            <Button
              type='button'
              variant='outline'
              onClick={view.openConfigure}
            >
              {t("consent.banner.configure")}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={view.rejectNonEssential}
            >
              {t("consent.banner.reject")}
            </Button>
            <Button type='button' onClick={view.acceptAll}>
              {t("consent.banner.acceptAll")}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={view.isConfigureOpen}
        onOpenChange={view.handleConfigureChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("consent.configure.title")}</DialogTitle>
            <DialogDescription>{t("consent.configure.body")}</DialogDescription>
          </DialogHeader>

          <div className='flex flex-col gap-4'>
            <div className='border-border-strong/40 bg-panel-strong flex items-start justify-between gap-4 rounded-xl border p-4'>
              <div className='flex min-w-0 flex-col gap-1'>
                <p className='text-foreground text-sm font-semibold tracking-tight'>
                  {t("consent.categories.essential.title")}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {t("consent.categories.essential.body")}
                </p>
              </div>
              <Switch
                aria-label={t("consent.categories.essential.title")}
                checked
                disabled
              />
            </div>

            <div className='border-border-strong/40 bg-panel-strong flex items-start justify-between gap-4 rounded-xl border p-4'>
              <div className='flex min-w-0 flex-col gap-1'>
                <p className='text-foreground text-sm font-semibold tracking-tight'>
                  {t("consent.categories.analytics.title")}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {t("consent.categories.analytics.body")}
                </p>
              </div>
              <Switch
                aria-label={t("consent.categories.analytics.title")}
                checked={view.draftCategories.analytics}
                onCheckedChange={view.handleAnalyticsChange}
              />
            </div>

            <div className='border-border-strong/40 bg-panel-strong flex items-start justify-between gap-4 rounded-xl border p-4'>
              <div className='flex min-w-0 flex-col gap-1'>
                <p className='text-foreground text-sm font-semibold tracking-tight'>
                  {t("consent.categories.marketing.title")}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {t("consent.categories.marketing.body")}
                </p>
              </div>
              <Switch
                aria-label={t("consent.categories.marketing.title")}
                checked={view.draftCategories.marketing}
                onCheckedChange={view.handleMarketingChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={view.closeConfigure}
            >
              {t("consent.configure.cancel")}
            </Button>
            <Button type='button' onClick={view.saveConfigure}>
              {t("consent.configure.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

CookieConsentBanner.displayName = "CookieConsentBanner";

export default CookieConsentBanner;
export { CookieConsentBanner };
