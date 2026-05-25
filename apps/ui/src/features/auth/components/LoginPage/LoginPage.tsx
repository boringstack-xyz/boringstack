import type { FC } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useLoginPage } from "./LoginPage.hooks";
import type { ILoginPageProps } from "./LoginPage.types";

const LoginPage: FC<ILoginPageProps> = (props) => {
  const { t } = useTranslation();
  const {
    register,
    errors,
    isSubmitting,
    submit,
    oauthProviders,
    oauthButtons,
    oauthPending,
    pendingEmail,
    onResendVerification,
    isResending
  } = useLoginPage(props);
  const hasOAuthProviders = oauthProviders.length > 0;
  const renderedOAuthButtons = oauthButtons.map((button) => (
    <Button
      key={button.provider}
      type='button'
      variant='outline'
      size='lg'
      className='w-full'
      onClick={button.onClick}
      disabled={oauthPending !== null}
    >
      {oauthPending === button.provider
        ? t("auth.oauth.exchanging")
        : t(button.labelKey)}
    </Button>
  ));

  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
      <Helmet>
        <title>
          {t("auth.login.title")} · {t("app.name")}
        </title>
      </Helmet>

      <form
        onSubmit={submit}
        noValidate
        className='flex w-full max-w-md flex-col gap-8'
        aria-labelledby='login-title'
      >
        <header className='flex flex-col gap-3'>
          <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
            {t("app.name")}
          </span>
          <h1
            id='login-title'
            className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'
          >
            {t("auth.login.title")}
          </h1>
        </header>

        <div className='flex flex-col gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='email'>{t("auth.login.email")}</Label>
            <Input
              id='email'
              type='email'
              autoComplete='email'
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={cn(errors.email && "border-destructive")}
              {...register("email")}
            />
            {errors.email ? (
              <p
                id='email-error'
                role='alert'
                className='text-destructive text-xs'
              >
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='password'>{t("auth.login.password")}</Label>
            <Input
              id='password'
              type='password'
              autoComplete='current-password'
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={cn(errors.password && "border-destructive")}
              {...register("password")}
            />
            {errors.password ? (
              <p
                id='password-error'
                role='alert'
                className='text-destructive text-xs'
              >
                {errors.password.message}
              </p>
            ) : null}
            <p className='text-right text-sm'>
              <Link
                to='/forgot-password'
                className='text-foreground font-medium underline-offset-4 hover:underline'
              >
                {t("auth.login.forgotPassword")}
              </Link>
            </p>
          </div>
        </div>

        <Button
          type='submit'
          size='lg'
          disabled={isSubmitting}
          className='w-full'
        >
          {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>

        {pendingEmail === null ? null : (
          <div
            role='status'
            aria-live='polite'
            className='border-warning/30 bg-warning/10 space-y-2 rounded-xl border p-4 text-sm'
          >
            <p>
              {t("auth.login.errors.emailNotVerifiedDetail", {
                email: pendingEmail
              })}
            </p>
            <Button
              type='button'
              variant='outline'
              className='w-full'
              onClick={onResendVerification}
              disabled={isResending}
            >
              {isResending
                ? t("auth.login.resendSending")
                : t("auth.login.resend")}
            </Button>
          </div>
        )}

        {hasOAuthProviders ? (
          <>
            <div
              className='text-muted-foreground flex items-center gap-3 text-[0.65rem] tracking-[0.18em] uppercase'
              aria-hidden='true'
            >
              <span className='bg-border h-px flex-1' />
              <span>{t("auth.oauth.divider")}</span>
              <span className='bg-border h-px flex-1' />
            </div>

            <div className='flex flex-col gap-2'>{renderedOAuthButtons}</div>
          </>
        ) : null}

        <p className='text-muted-foreground text-center text-sm'>
          {t("auth.login.noAccount")}{" "}
          <Link
            to='/signup'
            className='text-foreground font-semibold underline-offset-4 hover:underline'
          >
            {t("auth.login.signUp")}
          </Link>
        </p>
      </form>
    </main>
  );
};

LoginPage.displayName = "LoginPage";

export default LoginPage;
export { LoginPage };
