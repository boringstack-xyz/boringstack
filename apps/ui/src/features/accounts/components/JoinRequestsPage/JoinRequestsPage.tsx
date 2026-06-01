import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";

import { useJoinRequestsPage } from "./JoinRequestsPage.hooks";
import { formatRequestedAt, makeIdHandler } from "./JoinRequestsPage.utils";

const JoinRequestsPage: FC = () => {
  const { t } = useTranslation();
  const { isLoading, isError, requests, onApprove, onDeny, pendingActionId } =
    useJoinRequestsPage();

  const approveHandler = makeIdHandler(onApprove);
  const denyHandler = makeIdHandler(onDeny);

  const renderRows = requests
    .filter((row) => row.status === "pending")
    .map((row) => (
      <tr
        key={row.id}
        data-testid='join-request-row'
        data-request-id={row.id}
        className='border-border-strong/30 hover:bg-primary-low/20 border-b transition-colors last:border-0'
      >
        <td className='text-foreground px-4 py-3 text-sm'>{row.email}</td>
        <td className='text-muted-foreground px-4 py-3 text-xs'>
          {formatRequestedAt(row.createdAt)}
        </td>
        <td className='flex gap-2 px-4 py-3'>
          <Button
            type='button'
            size='sm'
            onClick={approveHandler(row.id)}
            disabled={pendingActionId !== null}
          >
            {pendingActionId === row.id
              ? t("accounts.joinRequests.approving")
              : t("accounts.joinRequests.approve")}
          </Button>
          <Button
            type='button'
            variant='destructive'
            size='sm'
            onClick={denyHandler(row.id)}
            disabled={pendingActionId !== null}
          >
            {pendingActionId === row.id
              ? t("accounts.joinRequests.denying")
              : t("accounts.joinRequests.deny")}
          </Button>
        </td>
      </tr>
    ));

  return (
    <AppPage
      pageTitle={t("accounts.joinRequests.pageTitle")}
      title={t("accounts.joinRequests.pageTitle")}
      subtitle={t("accounts.joinRequests.pageSubtitle")}
    >
      <section className='border-border-strong/40 bg-panel flex flex-col gap-4 rounded-2xl border p-6'>
        {isLoading ? (
          <p
            role='status'
            aria-live='polite'
            className='text-muted-foreground text-sm'
          >
            {t("accounts.joinRequests.loading")}
          </p>
        ) : null}

        {isError ? (
          <p role='alert' className='text-destructive text-sm'>
            {t("accounts.joinRequests.error")}
          </p>
        ) : null}

        {!isLoading && !isError && renderRows.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t("accounts.joinRequests.empty")}
          </p>
        ) : null}

        {renderRows.length > 0 ? (
          <table className='w-full text-left'>
            <thead>
              <tr className='border-border-strong/40 border-b'>
                <th className='text-muted-foreground px-4 py-3 text-xs tracking-[0.18em] uppercase'>
                  {t("accounts.joinRequests.columns.email")}
                </th>
                <th className='text-muted-foreground px-4 py-3 text-xs tracking-[0.18em] uppercase'>
                  {t("accounts.joinRequests.columns.requested")}
                </th>
                <th className='text-muted-foreground px-4 py-3 text-xs tracking-[0.18em] uppercase'>
                  {t("accounts.joinRequests.columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>{renderRows}</tbody>
          </table>
        ) : null}
      </section>
    </AppPage>
  );
};

JoinRequestsPage.displayName = "JoinRequestsPage";

export default JoinRequestsPage;
export { JoinRequestsPage };
