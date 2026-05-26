import type { FC } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FORGOT_PASSWORD_LOGIN_PATH } from "./ForgotPasswordPage.constants";
import { useForgotPasswordPage } from "./ForgotPasswordPage.hooks";
import type { IForgotPasswordPageProps } from "./ForgotPasswordPage.types";

const ForgotPasswordPage: FC<IForgotPasswordPageProps> = (props) => {
  const { t } = useTranslation();
  const { register, errors, isSubmitting, submit, submittedEmail } =
    useForgotPasswordPage(props);

  if (submittedEmail !== null) {
    return (
      <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
        <Helmet>
          <title>
            {t("auth.forgotPassword.checkEmailTitle")} · {t("app.name")}
          </title>
        </Helmet>
        <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
          <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
            {t("app.name")}
          </span>
          <h1 className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'>
            {t("auth.forgotPassword.checkEmailTitle")}
          </h1>
          <p className='text-muted-foreground text-base md:text-lg'>
            {t("auth.forgotPassword.checkEmailBody", { email: submittedEmail })}
          </p>
          <Button asChild variant='ghost' size='lg' className='w-full'>
            <Link to={FORGOT_PASSWORD_LOGIN_PATH}>
              {t("auth.forgotPassword.backToLogin")}
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
          {t("auth.forgotPassword.title")} · {t("app.name")}
        </title>
      </Helmet>

      <form
        onSubmit={submit}
        noValidate
        className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-8 rounded-2xl border p-8'
        aria-labelledby='forgot-password-title'
      >
        <header className='flex flex-col gap-3'>
          <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
            {t("app.name")}
          </span>
          <h1
            id='forgot-password-title'
            className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'
          >
            {t("auth.forgotPassword.title")}
          </h1>
          <p className='text-muted-foreground text-sm md:text-base'>
            {t("auth.forgotPassword.subtitle")}
          </p>
        </header>

        <div className='space-y-2'>
          <Label htmlFor='forgot-password-email'>
            {t("auth.forgotPassword.email")}
          </Label>
          <Input
            id='forgot-password-email'
            type='email'
            autoComplete='email'
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={
              errors.email ? "forgot-password-email-error" : undefined
            }
            className={cn(errors.email && "border-destructive")}
            {...register("email")}
          />
          {errors.email ? (
            <p
              id='forgot-password-email-error'
              role='alert'
              className='text-destructive text-xs'
            >
              {errors.email.message}
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
            ? t("auth.forgotPassword.submitting")
            : t("auth.forgotPassword.submit")}
        </Button>

        <p className='text-muted-foreground text-center text-sm'>
          <Link
            to={FORGOT_PASSWORD_LOGIN_PATH}
            className='text-foreground font-semibold underline-offset-4 hover:underline'
          >
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </p>
      </form>
    </main>
  );
};

ForgotPasswordPage.displayName = "ForgotPasswordPage";

export default ForgotPasswordPage;
export { ForgotPasswordPage };
