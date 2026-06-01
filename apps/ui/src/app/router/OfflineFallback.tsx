import type { FC } from "react";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface IOfflineFallbackProps {
  readonly onRetry: () => void;
  readonly isRetrying: boolean;
}

/*
 * Rendered by `ProtectedRoute` when `useMe()` errors with anything
 * other than 401/403 — the session cookie is still valid, the API is
 * unreachable, the user retries instead of being redirected through
 * /login. The body reflects that contract: no re-authentication ask.
 */
export const OfflineFallback: FC<IOfflineFallbackProps> = ({
  onRetry,
  isRetrying
}) => {
  const { t } = useTranslation();

  return (
    <div
      role='alert'
      aria-live='polite'
      className='flex min-h-screen items-center justify-center px-4'
    >
      <div className='border-border bg-card flex max-w-md flex-col gap-4 rounded-lg border p-6 text-center shadow-sm'>
        <h1 className='text-foreground text-lg font-semibold'>
          {t("offline.title")}
        </h1>
        <p className='text-muted-foreground text-sm'>{t("offline.body")}</p>
        <div className='flex justify-center'>
          <Button
            type='button'
            variant='default'
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? t("offline.retrying") : t("offline.retry")}
          </Button>
        </div>
      </div>
    </div>
  );
};
