import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useMfaChallengeForm } from "./MfaChallengeForm.hooks";
import type { IMfaChallengeFormProps } from "./MfaChallengeForm.types";

const MfaChallengeForm: FC<IMfaChallengeFormProps> = (props) => {
  const { mode, code, error, isSubmitting, onModeToggle } = props;
  const { t } = useTranslation();
  const { handleSubmit, handleChange } = useMfaChallengeForm(props);

  const isTotp = mode === "totp";
  const errorId = error === null ? undefined : "mfa-code-error";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'
      aria-labelledby='login-mfa-title'
    >
      <header className='flex flex-col gap-3'>
        <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
          {t("app.name")}
        </span>
        <h1
          id='login-mfa-title'
          className='text-foreground text-3xl leading-[1.1] font-bold tracking-tight md:text-4xl'
        >
          {t("auth.login.mfa.title")}
        </h1>
        <p className='text-muted-foreground text-sm'>
          {isTotp
            ? t("auth.login.mfa.totpHint")
            : t("auth.login.mfa.recoveryHint")}
        </p>
      </header>

      <div className='space-y-2'>
        <Label htmlFor='mfa-code'>
          {isTotp
            ? t("auth.login.mfa.codeLabel")
            : t("auth.login.mfa.recoveryLabel")}
        </Label>
        <Input
          id='mfa-code'
          type='text'
          autoComplete='one-time-code'
          inputMode={isTotp ? "numeric" : "text"}
          pattern={isTotp ? "[0-9]*" : undefined}
          maxLength={isTotp ? 6 : 10}
          value={code}
          onChange={handleChange}
          aria-invalid={error === null ? "false" : "true"}
          aria-describedby={errorId}
          className={cn(error !== null && "border-destructive")}
          autoFocus
          data-testid='mfa-login-code'
        />
        {error === null ? null : (
          <p id={errorId} role='alert' className='text-destructive text-xs'>
            {error}
          </p>
        )}
      </div>

      <Button
        type='submit'
        size='lg'
        disabled={isSubmitting || code.trim() === ""}
        className='w-full'
        data-testid='mfa-login-submit'
      >
        {isSubmitting
          ? t("auth.login.mfa.submitting")
          : t("auth.login.mfa.submit")}
      </Button>

      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={onModeToggle}
        disabled={isSubmitting}
      >
        {isTotp ? t("auth.login.mfa.useRecovery") : t("auth.login.mfa.useTotp")}
      </Button>
    </form>
  );
};

MfaChallengeForm.displayName = "MfaChallengeForm";

export default MfaChallengeForm;
export { MfaChallengeForm };
