import type { FC } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SIGNUP_LOGIN_PATH } from "./SignUpPage.constants";
import { useSignUpPage } from "./SignUpPage.hooks";
import type { ISignUpPageProps } from "./SignUpPage.types";

const SignUpPage: FC<ISignUpPageProps> = (props) => {
  const { t } = useTranslation();
  const {
    register,
    errors,
    isSubmitting,
    submit,
    submittedEmail,
    onResend,
    isResending
  } = useSignUpPage(props);

  if (submittedEmail !== null) {
    return (
      <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
        <Helmet>
          <title>
            {t("auth.checkEmail.title")} · {t("app.name")}
          </title>
        </Helmet>
        <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
          <span className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
            {t("app.name")}
          </span>
          <h1 className='text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t("auth.checkEmail.title")}
          </h1>
          <p className='text-muted-foreground text-base md:text-lg'>
            {t("auth.checkEmail.body", { email: submittedEmail })}
          </p>
          <div className='flex flex-col gap-2'>
            <Button
              type='button'
              variant='outline'
              size='lg'
              className='w-full'
              onClick={onResend}
              disabled={isResending}
            >
              {isResending
                ? t("auth.checkEmail.resendSending")
                : t("auth.checkEmail.resend")}
            </Button>
            <Button asChild variant='ghost' size='lg' className='w-full'>
              <Link to={SIGNUP_LOGIN_PATH}>{t("auth.checkEmail.back")}</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
      <Helmet>
        <title>
          {t("auth.signup.title")} · {t("app.name")}
        </title>
      </Helmet>

      <form
        onSubmit={submit}
        noValidate
        className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-8 rounded-2xl border p-8'
        aria-labelledby='signup-title'
      >
        <header className='flex flex-col gap-3'>
          <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
            {t("app.name")}
          </span>
          <h1
            id='signup-title'
            className='text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl'
          >
            {t("auth.signup.title")}
          </h1>
        </header>

        <div className='flex flex-col gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='signup-email'>{t("auth.signup.email")}</Label>
            <Input
              id='signup-email'
              type='email'
              autoComplete='email'
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              className={cn(errors.email && "border-destructive")}
              {...register("email")}
            />
            {errors.email ? (
              <p
                id='signup-email-error'
                role='alert'
                className='text-destructive text-xs'
              >
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='signup-password'>{t("auth.signup.password")}</Label>
            <Input
              id='signup-password'
              type='password'
              autoComplete='new-password'
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={
                errors.password ? "signup-password-error" : undefined
              }
              className={cn(errors.password && "border-destructive")}
              {...register("password")}
            />
            {errors.password ? (
              <p
                id='signup-password-error'
                role='alert'
                className='text-destructive text-xs'
              >
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='signup-first-name'>
                {t("auth.signup.firstName")}{" "}
                <span className='text-muted-foreground font-normal'>
                  ({t("auth.signup.optional")})
                </span>
              </Label>
              <Input
                id='signup-first-name'
                type='text'
                autoComplete='given-name'
                {...register("firstName")}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='signup-last-name'>
                {t("auth.signup.lastName")}{" "}
                <span className='text-muted-foreground font-normal'>
                  ({t("auth.signup.optional")})
                </span>
              </Label>
              <Input
                id='signup-last-name'
                type='text'
                autoComplete='family-name'
                {...register("lastName")}
              />
            </div>
          </div>
        </div>

        <Button
          type='submit'
          size='lg'
          disabled={isSubmitting}
          className='w-full'
        >
          {isSubmitting ? t("auth.signup.submitting") : t("auth.signup.submit")}
        </Button>

        <p className='text-muted-foreground text-center text-sm'>
          {t("auth.signup.haveAccount")}{" "}
          <Link
            to={SIGNUP_LOGIN_PATH}
            className='text-foreground font-semibold underline-offset-4 hover:underline'
          >
            {t("auth.signup.signIn")}
          </Link>
        </p>
      </form>
    </main>
  );
};

SignUpPage.displayName = "SignUpPage";

export default SignUpPage;
export { SignUpPage };
