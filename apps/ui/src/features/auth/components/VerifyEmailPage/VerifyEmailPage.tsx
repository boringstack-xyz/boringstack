import type { FC } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import {
  FAILURE_REDIRECT_PATH,
  useVerifyEmailPage
} from "./VerifyEmailPage.hooks";
import { resolveErrorMessage } from "./VerifyEmailPage.utils";

const VerifyEmailPage: FC = () => {
  const { t } = useTranslation();
  const { status, errorMessage } = useVerifyEmailPage();

  const heading = t("auth.verifyEmail.title");

  if (status === "verifying") {
    return (
      <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
        <Helmet>
          <title>
            {heading} · {t("app.name")}
          </title>
        </Helmet>
        <div
          role='status'
          aria-live='polite'
          className='flex flex-col items-center gap-4'
        >
          <div className='border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent' />
          <p className='text-muted-foreground text-sm'>
            {t("auth.verifyEmail.verifying")}
          </p>
        </div>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
        <Helmet>
          <title>
            {heading} · {t("app.name")}
          </title>
        </Helmet>
        <p
          role='status'
          aria-live='polite'
          className='text-foreground text-base font-medium'
        >
          {t("auth.verifyEmail.success")}
        </p>
      </main>
    );
  }

  const message = resolveErrorMessage(status, errorMessage, t);

  return (
    <main
      role='alert'
      className='bg-background flex min-h-screen items-center justify-center px-6 py-12'
    >
      <Helmet>
        <title>
          {heading} · {t("app.name")}
        </title>
      </Helmet>
      <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
        <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
          {t("app.name")}
        </span>
        <h1 className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'>
          {heading}
        </h1>
        <p className='text-muted-foreground text-sm break-words md:text-base'>
          {message}
        </p>
        <Button asChild size='lg' className='w-full'>
          <Link to={FAILURE_REDIRECT_PATH}>
            {t("auth.verifyEmail.backToLogin")}
          </Link>
        </Button>
      </div>
    </main>
  );
};

VerifyEmailPage.displayName = "VerifyEmailPage";

export default VerifyEmailPage;
export { VerifyEmailPage };
