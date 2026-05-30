import type { FC } from "react";
import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { ROLE } from "@/lib/acl/acl.types";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useInvitationsPage } from "./InvitationsPage.hooks";
import type { IInvitationsPageProps } from "./InvitationsPage.types";
import { formatExpiresAt, makeIdHandler } from "./InvitationsPage.utils";

const InvitationsPage: FC<IInvitationsPageProps> = () => {
  const { t } = useTranslation();
  const {
    canInvite,
    lockedReason,
    invitations,
    form,
    isSubmitting,
    submitError,
    onSubmit,
    onResend,
    onRevoke,
    isResending,
    isRevoking
  } = useInvitationsPage();

  const resendHandler = makeIdHandler(onResend);
  const revokeHandler = makeIdHandler(onRevoke);

  const renderedRows = invitations.map((row) => (
    <tr
      key={row.id}
      data-testid='invitation-row'
      data-invitation-id={row.id}
      className='border-border-strong/30 hover:bg-primary-low/20 border-b transition-colors last:border-0'
    >
      <td className='text-foreground px-4 py-3 text-sm'>{row.email}</td>
      <td className='text-muted-foreground px-4 py-3 text-xs tracking-[0.18em] uppercase'>
        {row.roleToAssign}
      </td>
      <td className='text-muted-foreground px-4 py-3 text-xs'>
        {formatExpiresAt(row.expiresAt)}
      </td>
      <td className='flex gap-2 px-4 py-3'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={resendHandler(row.id)}
          disabled={isResending}
        >
          {t("accounts.invitations.resend")}
        </Button>
        <Button
          type='button'
          variant='destructive'
          size='sm'
          onClick={revokeHandler(row.id)}
          disabled={isRevoking}
        >
          {t("accounts.invitations.revoke")}
        </Button>
      </td>
    </tr>
  ));

  return (
    <AppPage
      pageTitle={t("accounts.invitations.pageTitle")}
      title={t("accounts.invitations.pageTitle")}
      subtitle={t("accounts.invitations.pageSubtitle")}
    >
      {canInvite ? (
        <article className='border-border-strong/40 bg-panel flex flex-col gap-4 rounded-2xl border p-6'>
          <header className='flex flex-col gap-1'>
            <h2 className='text-foreground text-lg font-semibold tracking-tight'>
              {t("accounts.invitations.form.title")}
            </h2>
            <p className='text-muted-foreground text-sm'>
              {t("accounts.invitations.form.description")}
            </p>
          </header>
          <form
            onSubmit={onSubmit}
            className='grid gap-4 md:grid-cols-[1fr_160px_auto] md:items-end'
            aria-label={t("accounts.invitations.form.title")}
            noValidate
          >
            <div className='flex flex-col gap-2'>
              <Label htmlFor='invite-email'>
                {t("accounts.invitations.form.emailLabel")}
              </Label>
              <Input
                id='invite-email'
                type='email'
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p
                  className='text-destructive text-xs'
                  data-testid='invite-email-error'
                >
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='invite-role'>
                {t("accounts.invitations.form.roleLabel")}
              </Label>
              <select
                id='invite-role'
                className='border-border-strong/40 bg-panel-strong/60 hover:border-primary/60 focus:border-primary/60 focus:bg-panel focus:ring-primary/20 h-10 w-full rounded-xl border px-3 text-sm transition-[color,box-shadow,border-color] outline-none focus:ring-[3px]'
                {...form.register("roleToAssign")}
              >
                <option value={ROLE.admin}>
                  {t("accounts.invitations.roles.admin")}
                </option>
                <option value={ROLE.member}>
                  {t("accounts.invitations.roles.member")}
                </option>
                <option value={ROLE.viewer}>
                  {t("accounts.invitations.roles.viewer")}
                </option>
              </select>
            </div>
            <Button
              type='submit'
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              data-testid='invite-submit'
            >
              {isSubmitting
                ? t("accounts.invitations.form.submitting")
                : t("accounts.invitations.form.submit")}
            </Button>
          </form>
          {submitError !== null ? (
            <p
              className='text-destructive text-sm'
              role='alert'
              data-testid='invite-form-error'
            >
              {submitError}
            </p>
          ) : null}
        </article>
      ) : null}

      {lockedReason === "feature" ? (
        <article
          className='border-border-strong/40 bg-panel flex flex-col gap-3 rounded-2xl border p-6'
          data-testid='invite-locked-feature'
        >
          <header className='flex flex-col gap-1'>
            <h2 className='text-foreground text-lg font-semibold tracking-tight'>
              {t("accounts.invitations.locked.featureTitle")}
            </h2>
            <p className='text-muted-foreground text-sm'>
              {t("accounts.invitations.locked.featureBody")}
            </p>
          </header>
          <div>
            <Button asChild size='sm'>
              <Link to='/account/billing'>
                {t("accounts.invitations.locked.featureCta")}
              </Link>
            </Button>
          </div>
        </article>
      ) : null}

      {lockedReason === "role" ? (
        <article
          className='border-border-strong/40 bg-panel flex flex-col gap-2 rounded-2xl border p-6'
          data-testid='invite-locked-role'
        >
          <h2 className='text-foreground text-lg font-semibold tracking-tight'>
            {t("accounts.invitations.locked.roleTitle")}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {t("accounts.invitations.locked.roleBody")}
          </p>
        </article>
      ) : null}

      <article className='border-border-strong/40 bg-panel flex flex-col gap-4 rounded-2xl border p-6'>
        <header>
          <h2 className='text-foreground text-lg font-semibold tracking-tight'>
            {t("accounts.invitations.tableHeading")}
          </h2>
        </header>
        {invitations.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t("accounts.invitations.empty")}
          </p>
        ) : (
          <div className='-mx-6 overflow-x-auto'>
            <table className='w-full text-left'>
              <thead className='text-muted-foreground border-border border-b text-xs font-medium tracking-[0.18em] uppercase'>
                <tr>
                  <th className='px-4 py-3 font-medium'>
                    {t("accounts.invitations.columns.email")}
                  </th>
                  <th className='px-4 py-3 font-medium'>
                    {t("accounts.invitations.columns.role")}
                  </th>
                  <th className='px-4 py-3 font-medium'>
                    {t("accounts.invitations.columns.expiresAt")}
                  </th>
                  <th className='px-4 py-3 font-medium'>
                    {t("accounts.invitations.columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>{renderedRows}</tbody>
            </table>
          </div>
        )}
      </article>
    </AppPage>
  );
};

InvitationsPage.displayName = "InvitationsPage";

export default InvitationsPage;
export { InvitationsPage };
