import type { FC } from "react";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MFA_TOTP_CODE_LENGTH } from "./MfaSection.constants";
import { useMfaSection } from "./MfaSection.hooks";
import type {
  IMfaSectionProps,
  IMfaSubViewProps,
  IRecoveryListProps
} from "./MfaSection.types";

const RecoveryList: FC<IRecoveryListProps> = ({
  title,
  hint,
  codes,
  testId
}) => {
  const items = codes.map((code) => (
    <li
      key={code}
      className='bg-panel border-border-strong/40 rounded-md border px-3 py-2 font-mono text-sm'
    >
      {code}
    </li>
  ));

  return (
    <div
      className='border-border-strong/40 bg-panel-strong rounded-xl border p-4'
      data-testid={testId}
    >
      <p className='text-foreground mb-2 text-sm font-medium'>{title}</p>
      <p className='text-muted-foreground mb-3 text-xs'>{hint}</p>
      <ul className='grid grid-cols-2 gap-2'>{items}</ul>
    </div>
  );
};

RecoveryList.displayName = "RecoveryList";

const DisabledForm: FC<IMfaSubViewProps> = ({ view }) => (
  <form className='space-y-3' onSubmit={view.handleStartEnrollmentSubmit}>
    <div className='space-y-2'>
      <Label htmlFor='mfa-enroll-password'>
        {view.t("accounts.settings.mfa.passwordLabel")}
      </Label>
      <Input
        id='mfa-enroll-password'
        type='password'
        autoComplete='current-password'
        value={view.enrollPassword}
        onChange={view.handleEnrollPasswordChange}
        aria-invalid={view.enrollError === null ? "false" : "true"}
        aria-describedby={
          view.enrollError === null ? undefined : "mfa-enroll-error"
        }
        className={cn(view.enrollError !== null && "border-destructive")}
      />
      {view.enrollError === null ? null : (
        <p
          id='mfa-enroll-error'
          role='alert'
          className='text-destructive text-xs'
        >
          {view.enrollError}
        </p>
      )}
    </div>
    <Button
      type='submit'
      className='w-fit'
      disabled={view.isStarting}
      data-testid='mfa-enroll-start'
    >
      {view.isStarting
        ? view.t("accounts.settings.mfa.starting")
        : view.t("accounts.settings.mfa.enable")}
    </Button>
  </form>
);

DisabledForm.displayName = "DisabledForm";

const EnrollingForm: FC<IMfaSubViewProps> = ({ view }) => {
  if (view.state.kind !== "enrolling") {
    return null;
  }

  return (
    <div className='space-y-4'>
      <div className='border-border-strong/40 bg-panel-strong flex flex-col items-center gap-3 rounded-xl border p-4'>
        {view.qrDataUrl === null ? (
          <p className='text-muted-foreground text-sm'>
            {view.t("accounts.settings.mfa.qrLoading")}
          </p>
        ) : (
          <img
            src={view.qrDataUrl}
            alt={view.t("accounts.settings.mfa.qrAlt")}
            width={224}
            height={224}
            className='rounded-md'
            data-testid='mfa-qr'
          />
        )}
        <p className='text-muted-foreground text-center text-xs'>
          {view.t("accounts.settings.mfa.secretHint")}
        </p>
        <code
          className='bg-panel border-border-strong/40 rounded-md border px-3 py-2 text-xs break-all'
          data-testid='mfa-secret'
        >
          {view.state.setup.secretBase32}
        </code>
      </div>

      <RecoveryList
        title={view.t("accounts.settings.mfa.recoveryCodesTitle")}
        hint={view.t("accounts.settings.mfa.recoveryCodesHint")}
        codes={view.state.setup.recoveryCodes}
        testId='mfa-recovery-codes'
      />

      <form className='space-y-3' onSubmit={view.handleVerifyEnrollmentSubmit}>
        <div className='space-y-2'>
          <Label htmlFor='mfa-verify-code'>
            {view.t("accounts.settings.mfa.firstCodeLabel")}
          </Label>
          <Input
            id='mfa-verify-code'
            type='text'
            autoComplete='one-time-code'
            inputMode='numeric'
            pattern='[0-9]*'
            maxLength={MFA_TOTP_CODE_LENGTH}
            value={view.verifyCode}
            onChange={view.handleVerifyCodeChange}
            aria-invalid={view.verifyError === null ? "false" : "true"}
            aria-describedby={
              view.verifyError === null ? undefined : "mfa-verify-error"
            }
            className={cn(view.verifyError !== null && "border-destructive")}
            data-testid='mfa-verify-input'
          />
          {view.verifyError === null ? null : (
            <p
              id='mfa-verify-error'
              role='alert'
              className='text-destructive text-xs'
            >
              {view.verifyError}
            </p>
          )}
        </div>
        <div className='flex gap-2'>
          <Button
            type='submit'
            disabled={view.isVerifying}
            data-testid='mfa-verify-submit'
          >
            {view.isVerifying
              ? view.t("accounts.settings.mfa.verifying")
              : view.t("accounts.settings.mfa.confirm")}
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={view.onCancelEnrollment}
            disabled={view.isVerifying}
          >
            {view.t("accounts.settings.mfa.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
};

EnrollingForm.displayName = "EnrollingForm";

const RegenerateForm: FC<IMfaSubViewProps> = ({ view }) => (
  <form className='space-y-3' onSubmit={view.handleRegenerateSubmit}>
    <div className='space-y-2'>
      <Label htmlFor='mfa-regenerate-password'>
        {view.t("accounts.settings.mfa.regeneratePasswordLabel")}
      </Label>
      <Input
        id='mfa-regenerate-password'
        type='password'
        autoComplete='current-password'
        value={view.regeneratePassword}
        onChange={view.handleRegeneratePasswordChange}
        aria-invalid={view.regenerateError === null ? "false" : "true"}
        aria-describedby={
          view.regenerateError === null ? undefined : "mfa-regenerate-error"
        }
        className={cn(view.regenerateError !== null && "border-destructive")}
      />
      {view.regenerateError === null ? null : (
        <p
          id='mfa-regenerate-error'
          role='alert'
          className='text-destructive text-xs'
        >
          {view.regenerateError}
        </p>
      )}
    </div>
    <Button
      type='submit'
      variant='outline'
      className='w-fit'
      disabled={view.isRegenerating}
    >
      {view.isRegenerating
        ? view.t("accounts.settings.mfa.regenerating")
        : view.t("accounts.settings.mfa.regenerate")}
    </Button>
  </form>
);

RegenerateForm.displayName = "RegenerateForm";

const DisableForm: FC<IMfaSubViewProps> = ({ view }) => (
  <form className='space-y-3' onSubmit={view.handleDisableSubmit}>
    <div className='space-y-2'>
      <Label htmlFor='mfa-disable-password'>
        {view.t("accounts.settings.mfa.disablePasswordLabel")}
      </Label>
      <Input
        id='mfa-disable-password'
        type='password'
        autoComplete='current-password'
        value={view.disablePassword}
        onChange={view.handleDisablePasswordChange}
        aria-invalid={view.disableError === null ? "false" : "true"}
        aria-describedby={
          view.disableError === null ? undefined : "mfa-disable-error"
        }
        className={cn(view.disableError !== null && "border-destructive")}
      />
      {view.disableError === null ? null : (
        <p
          id='mfa-disable-error'
          role='alert'
          className='text-destructive text-xs'
        >
          {view.disableError}
        </p>
      )}
    </div>
    <Button
      type='submit'
      variant='destructive'
      className='w-fit'
      disabled={view.isDisabling}
      data-testid='mfa-disable-submit'
    >
      {view.isDisabling
        ? view.t("accounts.settings.mfa.disabling")
        : view.t("accounts.settings.mfa.disable")}
    </Button>
  </form>
);

DisableForm.displayName = "DisableForm";

const EnabledBody: FC<IMfaSubViewProps> = ({ view }) => {
  if (view.state.kind !== "enabled") {
    return null;
  }

  return (
    <div className='space-y-4'>
      <div className='border-border-strong/40 bg-panel-strong flex items-center justify-between rounded-xl border px-4 py-3'>
        <div>
          <p className='text-foreground text-sm font-medium'>
            {view.t("accounts.settings.mfa.statusActive")}
          </p>
          <p className='text-muted-foreground text-xs'>
            {view.t("accounts.settings.mfa.statusActiveHint")}
          </p>
        </div>
        <span
          className='text-foreground bg-primary/20 rounded-md px-2 py-1 text-xs font-medium'
          aria-live='polite'
        >
          {view.t("accounts.settings.mfa.statusBadge")}
        </span>
      </div>

      {view.state.recoveryCodes === null ? null : (
        <RecoveryList
          title={view.t("accounts.settings.mfa.freshCodesTitle")}
          hint={view.t("accounts.settings.mfa.freshCodesHint")}
          codes={view.state.recoveryCodes}
          testId='mfa-fresh-recovery'
        />
      )}

      <RegenerateForm view={view} />
      <DisableForm view={view} />
    </div>
  );
};

EnabledBody.displayName = "EnabledBody";

const MfaSectionBody: FC<IMfaSubViewProps> = ({ view }) => {
  if (view.state.kind === "loading") {
    return (
      <p className='text-muted-foreground text-sm'>
        {view.t("common.loading")}
      </p>
    );
  }

  if (view.state.kind === "disabled") {
    return <DisabledForm view={view} />;
  }

  if (view.state.kind === "enrolling") {
    return <EnrollingForm view={view} />;
  }

  return <EnabledBody view={view} />;
};

MfaSectionBody.displayName = "MfaSectionBody";

const MfaSection: FC<IMfaSectionProps> = ({ className }) => {
  const view = useMfaSection();

  return (
    <article
      className={cn(
        "border-border-strong/40 bg-panel flex flex-col gap-4 rounded-2xl border p-6",
        className
      )}
      data-testid='mfa-section'
    >
      <header className='flex flex-col gap-1'>
        <h2 className='text-foreground text-lg font-semibold tracking-tight'>
          {view.t("accounts.settings.mfa.title")}
        </h2>
        <p className='text-muted-foreground text-sm'>
          {view.t("accounts.settings.mfa.body")}
        </p>
      </header>
      <MfaSectionBody view={view} />
    </article>
  );
};

MfaSection.displayName = "MfaSection";

export default MfaSection;
export { MfaSection };
