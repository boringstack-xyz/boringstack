import type { FC } from "react";
import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useLoginCredentialsForm } from "./LoginCredentialsForm.hooks";
import type { ILoginCredentialsFormProps } from "./LoginCredentialsForm.types";

const LoginCredentialsForm: FC<ILoginCredentialsFormProps> = ({
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
}) => {
  const { t } = useTranslation();
  const { hasOAuthProviders } = useLoginCredentialsForm({ oauthProviders });
  const oauthButtonElements = oauthButtons.map((button) => (
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
    <form
      onSubmit={submit}
      noValidate
      className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-8 rounded-2xl border p-8'
      aria-labelledby='login-title'
    >
      <header className='flex flex-col gap-3'>
        <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
          {t("app.name")}
        </span>
        <h1
          id='login-title'
          className='text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl'
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

          <div className='flex flex-col gap-2'>{oauthButtonElements}</div>
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
  );
};

LoginCredentialsForm.displayName = "LoginCredentialsForm";

export default LoginCredentialsForm;
export { LoginCredentialsForm };
