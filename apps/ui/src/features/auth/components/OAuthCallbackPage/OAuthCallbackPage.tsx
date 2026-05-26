import type { FC } from "react";
import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import {
  FAILURE_REDIRECT_PATH,
  useOAuthCallbackPage
} from "./OAuthCallbackPage.hooks";

const OAuthCallbackPage: FC = () => {
  const { t } = useTranslation();
  const { status, errorMessage } = useOAuthCallbackPage();

  if (status === "exchanging") {
    return (
      <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
        <div
          role='status'
          aria-live='polite'
          className='flex flex-col items-center gap-4'
        >
          <div className='border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent' />
          <p className='text-muted-foreground text-sm'>
            {t("auth.oauth.exchanging")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      role='alert'
      className='bg-background flex min-h-screen items-center justify-center px-6 py-12'
    >
      <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
        <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
          {t("app.name")}
        </span>
        <h1 className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'>
          {t("auth.oauth.failed.title")}
        </h1>
        {errorMessage !== null ? (
          <p className='text-muted-foreground text-sm break-words md:text-base'>
            {errorMessage}
          </p>
        ) : null}
        <Button asChild size='lg' className='w-full'>
          <Link to={FAILURE_REDIRECT_PATH}>{t("auth.oauth.failed.back")}</Link>
        </Button>
      </div>
    </main>
  );
};

OAuthCallbackPage.displayName = "OAuthCallbackPage";

export default OAuthCallbackPage;
export { OAuthCallbackPage };
