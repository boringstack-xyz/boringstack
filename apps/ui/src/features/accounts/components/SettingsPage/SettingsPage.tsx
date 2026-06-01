import type { FC } from "react";

import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MfaSection } from "./MfaSection";
import { useSettingsPage } from "./SettingsPage.hooks";
import type {
  ISettingsDetailRowsProps,
  ISettingsPageProps,
  ISettingsSectionCardProps,
  ISettingsSectionView
} from "./SettingsPage.types";
import { WebPushCard } from "./WebPushCard";

const SettingsDetailRows: FC<ISettingsDetailRowsProps> = ({ rows }) => {
  const renderedRows = rows.map((row) => (
    <div
      key={row.id}
      className='border-border-strong/40 bg-panel-strong rounded-xl border px-4 py-3'
    >
      <dt className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
        {row.label}
      </dt>
      <dd className='text-foreground mt-1 text-sm font-medium'>{row.value}</dd>
    </div>
  ));

  return <dl className='grid gap-3 sm:grid-cols-3'>{renderedRows}</dl>;
};

SettingsDetailRows.displayName = "SettingsDetailRows";

const SettingsSectionCard: FC<ISettingsSectionCardProps> = ({
  section,
  children
}) => (
  <article className='border-border-strong/40 bg-panel flex flex-col gap-4 rounded-2xl border p-6'>
    <header className='flex flex-col gap-1'>
      <h2 className='text-foreground text-lg font-semibold tracking-tight'>
        {section.title}
      </h2>
      <p className='text-muted-foreground text-sm'>{section.body}</p>
    </header>
    {children}
  </article>
);

SettingsSectionCard.displayName = "SettingsSectionCard";

const AccountSection: FC<{
  readonly section: ISettingsSectionView;
  readonly view: ReturnType<typeof useSettingsPage>;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ section, view, t }) => (
  <SettingsSectionCard section={section}>
    <SettingsDetailRows rows={view.accountRows} />
    <form onSubmit={view.submitRenameAccount} noValidate className='space-y-3'>
      <div className='space-y-2'>
        <Label htmlFor='settings-account-name'>
          {t("accounts.settings.account.renameLabel")}
        </Label>
        <Input
          id='settings-account-name'
          aria-invalid={view.accountNameErrors.name ? "true" : "false"}
          aria-describedby={
            view.accountNameErrors.name
              ? "settings-account-name-error"
              : undefined
          }
          {...view.registerAccountName("name")}
        />
        {view.accountNameErrors.name ? (
          <p
            id='settings-account-name-error'
            role='alert'
            className='text-destructive text-xs'
          >
            {view.accountNameErrors.name.message}
          </p>
        ) : null}
      </div>
      <Button type='submit' className='w-fit' disabled={view.isRenamingAccount}>
        {view.isRenamingAccount
          ? t("accounts.settings.account.renaming")
          : t("accounts.settings.account.renameSubmit")}
      </Button>
    </form>
  </SettingsSectionCard>
);

const SecuritySection: FC<{
  readonly section: ISettingsSectionView;
  readonly view: ReturnType<typeof useSettingsPage>;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ section, view, t }) => (
  <SettingsSectionCard section={section}>
    <SettingsDetailRows rows={view.securityRows} />
    {view.isPasswordLoginEnabled ? (
      <form
        onSubmit={view.submitChangePassword}
        noValidate
        className='grid gap-4 md:grid-cols-2'
      >
        <div className='space-y-2'>
          <Label htmlFor='settings-current-password'>
            {t("accounts.settings.security.currentPassword")}
          </Label>
          <Input
            id='settings-current-password'
            type='password'
            autoComplete='current-password'
            aria-invalid={
              view.passwordErrors.currentPassword ? "true" : "false"
            }
            aria-describedby={
              view.passwordErrors.currentPassword
                ? "settings-current-password-error"
                : undefined
            }
            {...view.registerPassword("currentPassword")}
          />
          {view.passwordErrors.currentPassword ? (
            <p
              id='settings-current-password-error'
              role='alert'
              className='text-destructive text-xs'
            >
              {view.passwordErrors.currentPassword.message}
            </p>
          ) : null}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='settings-new-password'>
            {t("accounts.settings.security.newPassword")}
          </Label>
          <Input
            id='settings-new-password'
            type='password'
            autoComplete='new-password'
            aria-invalid={view.passwordErrors.newPassword ? "true" : "false"}
            aria-describedby={
              view.passwordErrors.newPassword
                ? "settings-new-password-error"
                : undefined
            }
            {...view.registerPassword("newPassword")}
          />
          {view.passwordErrors.newPassword ? (
            <p
              id='settings-new-password-error'
              role='alert'
              className='text-destructive text-xs'
            >
              {view.passwordErrors.newPassword.message}
            </p>
          ) : null}
        </div>

        <div className='md:col-span-2'>
          <Button
            type='submit'
            className='w-fit'
            disabled={view.isChangingPassword}
          >
            {view.isChangingPassword
              ? t("accounts.settings.security.changingPassword")
              : t("accounts.settings.security.changePassword")}
          </Button>
        </div>
      </form>
    ) : (
      <p className='text-muted-foreground text-sm'>
        {t("accounts.settings.security.passwordLoginDisabled")}
      </p>
    )}
  </SettingsSectionCard>
);

const OAuthSection: FC<{
  readonly section: ISettingsSectionView;
  readonly view: ReturnType<typeof useSettingsPage>;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ section, view, t }) => {
  const oauthRows = view.oauthProviders.map((provider) => ({
    ...provider,
    onConnect: (): void => {
      view.onConnectProvider(provider.provider);
    },
    onDisconnect: (): void => {
      view.onDisconnectProvider(provider.provider);
    }
  }));

  return (
    <SettingsSectionCard section={section}>
      <div className='space-y-3'>
        {oauthRows.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t("accounts.settings.oauth.noProviders")}
          </p>
        ) : (
          oauthRows.map((provider) => (
            <div
              key={provider.provider}
              className='border-border-strong/40 bg-panel-strong flex items-center justify-between rounded-xl border px-4 py-3'
            >
              <div className='flex flex-col'>
                <p className='text-sm font-medium'>
                  {t(`auth.oauth.${provider.provider}`)}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {provider.isLinked
                    ? t("accounts.settings.oauth.connected")
                    : t("accounts.settings.oauth.notConnected")}
                </p>
              </div>
              {provider.isLinked ? (
                <Button
                  type='button'
                  variant='outline'
                  onClick={provider.onDisconnect}
                  disabled={view.disconnectingProvider === provider.provider}
                >
                  {view.disconnectingProvider === provider.provider
                    ? t("accounts.settings.oauth.disconnecting")
                    : t("accounts.settings.oauth.disconnect")}
                </Button>
              ) : (
                <Button type='button' onClick={provider.onConnect}>
                  {t("accounts.settings.oauth.connect")}
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </SettingsSectionCard>
  );
};

const DeleteAccountControls: FC<{
  readonly view: ReturnType<typeof useSettingsPage>;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ view, t }) => (
  <div className='flex flex-col gap-4'>
    <div className='flex flex-col gap-2'>
      <Label htmlFor='delete-account-confirmation'>
        {t("accounts.settings.sections.danger.confirmLabel", {
          accountName: view.deleteConfirmationTarget
        })}
      </Label>
      <Input
        id='delete-account-confirmation'
        value={view.deleteConfirmation}
        onChange={view.onDeleteConfirmationInputChange}
        autoComplete='off'
      />
    </div>
    {view.deleteError !== null ? (
      <p className='text-destructive text-sm' role='alert'>
        {view.deleteError}
      </p>
    ) : null}
    <Button
      type='button'
      variant='destructive'
      className='w-fit'
      onClick={view.onDeleteAccount}
      disabled={view.isDeleteDisabled}
    >
      <Trash2 className='size-4' aria-hidden='true' />
      <span>
        {view.isDeletingAccount
          ? t("accounts.settings.sections.danger.deleting")
          : t("accounts.settings.sections.danger.delete")}
      </span>
    </Button>
  </div>
);

const LeaveAccountControls: FC<{
  readonly view: ReturnType<typeof useSettingsPage>;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ view, t }) => (
  <div className='flex flex-col gap-3'>
    <p className='text-muted-foreground text-sm'>
      {t("accounts.settings.sections.danger.leaveBody")}
    </p>
    {view.leaveError !== null ? (
      <p className='text-destructive text-sm' role='alert'>
        {view.leaveError}
      </p>
    ) : null}
    <Button
      type='button'
      variant='outline'
      className='w-fit'
      onClick={view.onLeaveAccount}
      disabled={view.isLeavingAccount}
    >
      {view.isLeavingAccount
        ? t("accounts.settings.sections.danger.leaving")
        : t("accounts.settings.sections.danger.leave")}
    </Button>
  </div>
);

const DangerBody: FC<{
  readonly view: ReturnType<typeof useSettingsPage>;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ view, t }) => {
  if (view.canDeleteAccount) {
    return <DeleteAccountControls view={view} t={t} />;
  }

  if (view.canLeaveAccount) {
    return <LeaveAccountControls view={view} t={t} />;
  }

  return (
    <p className='text-muted-foreground text-sm'>
      {t("accounts.settings.sections.danger.ownerOnly")}
    </p>
  );
};

const DangerSection: FC<{
  readonly section: ISettingsSectionView;
  readonly view: ReturnType<typeof useSettingsPage>;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ section, view, t }) => (
  <SettingsSectionCard section={section}>
    <DangerBody view={view} t={t} />
  </SettingsSectionCard>
);

const SettingsPage: FC<ISettingsPageProps> = () => {
  const { t } = useTranslation();
  const view = useSettingsPage();
  const accountSection = view.sections.find(
    (section) => section.id === "account"
  );
  const securitySection = view.sections.find(
    (section) => section.id === "security"
  );
  const dangerSection = view.sections.find(
    (section) => section.id === "danger"
  );
  const oauthSection = view.sections.find((section) => section.id === "oauth");

  return (
    <AppPage
      pageTitle={view.pageTitle}
      title={view.pageTitle}
      subtitle={view.pageSubtitle}
    >
      {accountSection ? (
        <AccountSection section={accountSection} view={view} t={t} />
      ) : null}

      {securitySection ? (
        <SecuritySection section={securitySection} view={view} t={t} />
      ) : null}

      <MfaSection />

      {oauthSection ? (
        <OAuthSection section={oauthSection} view={view} t={t} />
      ) : null}

      <WebPushCard />

      {dangerSection ? (
        <DangerSection section={dangerSection} view={view} t={t} />
      ) : null}
    </AppPage>
  );
};

SettingsPage.displayName = "SettingsPage";

export default SettingsPage;
export { SettingsPage };
