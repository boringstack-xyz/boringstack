import type { FC, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { useMe } from "@/features/auth/Auth.queries";
import { resolveAuthStatus } from "@/features/auth/Auth.queries.utils";

import { OfflineFallback } from "./OfflineFallback";

const AUTH_CHECK_TIMEOUT_MS = 5_000;

interface IProtectedRouteProps {
  readonly children: ReactElement;
}

export const ProtectedRoute: FC<IProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const me = useMe();
  const { data, error, isPending, isFetching, refetch } = me;
  const [timedOut, setTimedOut] = useState(false);

  /*
   * Wait when either:
   *   1. `isPending` — first fetch ever; no cached data exists.
   *   2. `!data && !error && isFetching` — cached `null`/undefined with
   *      a refetch in flight. Covers the post-login window: a
   *      `useMe` invalidation can race the `navigate('/dashboard')`
   *      and ProtectedRoute mounts while the refetch is still
   *      resolving; without this guard a cached `null` would
   *      redirect to /login mid-refetch.
   */
  const isResolving =
    (isPending || (data == null && error == null && isFetching)) && !timedOut;

  useEffect(() => {
    if (!isResolving) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, AUTH_CHECK_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isResolving]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isResolving) {
    return (
      <div
        role='status'
        aria-live='polite'
        className='flex min-h-screen items-center justify-center'
      >
        <span className='sr-only'>{t("common.loading")}</span>
        <div className='border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent' />
      </div>
    );
  }

  const status = resolveAuthStatus({ data, error });

  if (status === null) {
    // Timed out before resolving — treat the same as "not authed".
    return <Navigate to='/login' replace state={{ from: location }} />;
  }

  if (status.kind === "offline") {
    return <OfflineFallback onRetry={handleRetry} isRetrying={isFetching} />;
  }

  if (status.kind === "anonymous" || status.kind === "unauthorized") {
    return <Navigate to='/login' replace state={{ from: location }} />;
  }

  return children;
};
