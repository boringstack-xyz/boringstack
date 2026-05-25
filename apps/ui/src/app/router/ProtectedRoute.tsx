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
  const { data, isPending } = useMe();
  const [timedOut, setTimedOut] = useState(false);

  /*
   * Only arm the timer while the auth check is pending. Once useMe
   * resolves (success or error), the timer is cleared. Without the
   * isPending guard the timer fires unconditionally and the resulting
   * `timedOut` flag would redirect an already-authenticated user back
   * to /login after 5s on any protected page.
   */
  useEffect(() => {
    if (!isPending) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, AUTH_CHECK_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isPending]);

  if (isPending && !timedOut) {
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
