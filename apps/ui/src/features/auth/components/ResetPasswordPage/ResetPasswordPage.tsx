import type { FC } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RESET_PASSWORD_LOGIN_PATH } from "./ResetPasswordPage.constants";
import { useResetPasswordPage } from "./ResetPasswordPage.hooks";
import type { IResetPasswordPageProps } from "./ResetPasswordPage.types";

const ResetPasswordPage: FC<IResetPasswordPageProps> = (props) => {
  const { t } = useTranslation();
  const { state, register, errors, isSubmitting, submit } =
    useResetPasswordPage(props);

  if (state === "missingToken") {
    return (
      <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
        <Helmet>
          <title>
            {t("auth.resetPassword.invalidTokenTitle")} · {t("app.name")}
          </title>
        </Helmet>
        <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
          <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
            {t("app.name")}
          </span>
          <h1 className='text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t("auth.resetPassword.invalidTokenTitle")}
          </h1>
          <p className='text-muted-foreground text-base md:text-lg'>
            {t("auth.resetPassword.missingToken")}
          </p>
          <Button asChild variant='ghost' size='lg' className='w-full'>
            <Link to={RESET_PASSWORD_LOGIN_PATH}>
              {t("auth.resetPassword.backToLogin")}
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  if (state === "success") {
    return (
      <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
        <Helmet>
          <title>
            {t("auth.resetPassword.successTitle")} · {t("app.name")}
          </title>
        </Helmet>
        <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
          <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
            {t("app.name")}
          </span>
          <h1 className='text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t("auth.resetPassword.successTitle")}
          </h1>
          <p className='text-muted-foreground text-base md:text-lg'>
            {t("auth.resetPassword.successBody")}
          </p>
          <Button asChild size='lg' className='w-full'>
            <Link to={RESET_PASSWORD_LOGIN_PATH}>
              {t("auth.resetPassword.backToLogin")}
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
      <Helmet>
        <title>
          {t("auth.resetPassword.title")} · {t("app.name")}
        </title>
      </Helmet>

      <form
        onSubmit={submit}
        noValidate
        className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-8 rounded-2xl border p-8'
        aria-labelledby='reset-password-title'
      >
        <header className='flex flex-col gap-3'>
          <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
            {t("app.name")}
          </span>
          <h1
            id='reset-password-title'
            className='text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl'
          >
            {t("auth.resetPassword.title")}
          </h1>
          <p className='text-muted-foreground text-sm md:text-base'>
            {t("auth.resetPassword.subtitle")}
          </p>
        </header>

        {state === "invalidToken" ? (
          <p
            role='alert'
            className='border-destructive/40 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm'
          >
            {t("auth.resetPassword.invalidToken")}
          </p>
        ) : null}

        <div className='space-y-2'>
          <Label htmlFor='reset-password-password'>
            {t("auth.resetPassword.password")}
          </Label>
          <Input
            id='reset-password-password'
            type='password'
            autoComplete='new-password'
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={
              errors.password ? "reset-password-password-error" : undefined
            }
            className={cn(errors.password && "border-destructive")}
            {...register("password")}
          />
          {errors.password ? (
            <p
              id='reset-password-password-error'
              role='alert'
              className='text-destructive text-xs'
            >
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <Button
          type='submit'
          size='lg'
          disabled={isSubmitting}
          className='w-full'
        >
          {isSubmitting
            ? t("auth.resetPassword.submitting")
            : t("auth.resetPassword.submit")}
        </Button>

        <p className='text-muted-foreground text-center text-sm'>
          <Link
            to={RESET_PASSWORD_LOGIN_PATH}
            className='text-foreground font-semibold underline-offset-4 hover:underline'
          >
            {t("auth.resetPassword.backToLogin")}
          </Link>
        </p>
      </form>
    </main>
  );
};

ResetPasswordPage.displayName = "ResetPasswordPage";

export default ResetPasswordPage;
export { ResetPasswordPage };
