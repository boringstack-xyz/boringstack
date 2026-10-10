import type { FC, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { storeReturnTo } from "@/lib/auth/return-to";
import { useMe } from "@/lib/session";

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
   *   1. `isPending`: first fetch ever; no cached data exists.
   *   2. `!data && !error && isFetching`: cached `null`/undefined with
   *      a refetch in flight. Covers the post-login window: a
   *      `useMe` invalidation can race the `navigate('/dashboard')`
   *      and ProtectedRoute mounts while the refetch is still
   *      resolving; without this guard a cached `null` would
   *      redirect to /login mid-refetch.
   */
  const isResolving =
    (isPending || (data == null && error == null && isFetching)) && !timedOut;

  const status = resolveAuthStatus({ data, error });
  const isLoggedOut =
    !isResolving &&
    (status === null ||
      status.kind === "anonymous" ||
      status.kind === "unauthorized");
  const attemptedPath = `${location.pathname}${location.search}${location.hash}`;

  /*
   * Remember the page the visitor wanted, so login, email verification and
   * the OAuth callback can send them back to it. `state.from` covers only the
   * password login path; the stored value survives the OAuth round trip.
   */
  useEffect(() => {
    if (isLoggedOut) {
      storeReturnTo(attemptedPath);
    }
  }, [attemptedPath, isLoggedOut]);

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

  if (status === null) {
    // Timed out before resolving: treat the same as "not authed".
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
