import type { FC } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { POST_ACTION_PATH } from "./OwnershipTransferAcceptPage.constants";
import { useOwnershipTransferAcceptPage } from "./OwnershipTransferAcceptPage.hooks";
import { resolveStatusMessage } from "./OwnershipTransferAcceptPage.utils";

const OwnershipTransferAcceptPage: FC = () => {
  const { t } = useTranslation();
  const { status, errorMessage, onAccept, onDecline } =
    useOwnershipTransferAcceptPage();

  const heading = t("accounts.ownershipTransfer.pageTitle");
  const message = resolveStatusMessage(status, errorMessage, t);

  const isTerminal =
    status === "accepted" ||
    status === "declined" ||
    status === "missing-token" ||
    status === "invalid-token" ||
    status === "error";

  const isWorking = status === "accepting" || status === "declining";

  return (
    <main
      role={isTerminal ? "alert" : "main"}
      className='bg-background flex min-h-screen items-center justify-center px-6 py-12'
    >
      <Helmet>
        <title>
          {heading} · {t("app.name")}
        </title>
      </Helmet>
      <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
        <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
          {t("app.name")}
        </span>
        <h1 className='text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
          {heading}
        </h1>
        <p className='text-muted-foreground text-sm break-words md:text-base'>
          {message}
        </p>

        {isTerminal ? (
          <Button asChild size='lg' className='w-full'>
            <Link to={POST_ACTION_PATH}>
              {t("accounts.ownershipTransfer.goToAccount")}
            </Link>
          </Button>
        ) : (
          <div className='flex flex-col gap-3 md:flex-row md:gap-2'>
            <Button
              type='button'
              size='lg'
              className='w-full md:flex-1'
              onClick={onAccept}
              disabled={isWorking}
            >
              {status === "accepting"
                ? t("accounts.ownershipTransfer.accepting")
                : t("accounts.ownershipTransfer.accept")}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='lg'
              className='w-full md:flex-1'
              onClick={onDecline}
              disabled={isWorking}
            >
              {status === "declining"
                ? t("accounts.ownershipTransfer.declining")
                : t("accounts.ownershipTransfer.decline")}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

OwnershipTransferAcceptPage.displayName = "OwnershipTransferAcceptPage";

export default OwnershipTransferAcceptPage;
export { OwnershipTransferAcceptPage };
