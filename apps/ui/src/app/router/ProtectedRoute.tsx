import type { FC, ReactElement } from "react";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { useMe } from "@/features/auth/Auth.queries";

const AUTH_CHECK_TIMEOUT_MS = 5_000;

interface IProtectedRouteProps {
  readonly children: ReactElement;
}

export const ProtectedRoute: FC<IProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const { data, isPending, isFetching } = useMe();
  const [timedOut, setTimedOut] = useState(false);

  /*
   * Wait when either:
   *   1. `isPending` — first fetch ever; no cached data exists. The
   *      classic "auth check is loading" case.
   *   2. `!data && isFetching` — we have cached `null` (from a previous
   *      unauthenticated /me, or from logout writing setQueryData null)
   *      and a refetch is in flight. This is the post-login window:
   *      `useLogin.onSuccess` invalidated `useMe`, login resolved,
   *      `navigate('/dashboard')` fired, and ProtectedRoute mounted
   *      before the invalidation-triggered refetch returned. Without
   *      this guard, the cached `null` made ProtectedRoute redirect
   *      back to `/login` mid-refetch — the password-reset Playwright
   *      spec hit this deterministically on CI because the post-reset
   *      cache + setUser path widened the refetch window enough.
   */
  const isResolving = (isPending || (data === null && isFetching)) && !timedOut;

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

  if (!data) {
    return <Navigate to='/login' replace state={{ from: location }} />;
  }

  return children;
};
