import type { FC } from "react";
import { useCallback, useEffect } from "react";
import { Link, useLocation, useRouteError } from "react-router-dom";

import * as Sentry from "@sentry/react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/lib/api/ApiError";
import { logger } from "@/lib/logger/logger";

import { Button } from "@/components/ui/button";

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "unknown";
}

function headlineFor(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return t("errors.route.unauthorized");
  }

  if (error instanceof ApiError && error.isForbidden) {
    return t("errors.route.forbidden");
  }

  if (error instanceof ApiError && error.isRateLimited) {
    return t("errors.route.rateLimited");
  }

  if (error instanceof ApiError && error.isServer) {
    return t("errors.route.server");
  }

  return t("errors.route.generic");
}

/**
 * Per-route error boundary. Wired via React Router's `errorElement` on every
 * route in `routes.tsx`. Catches errors thrown during render or by route
 * loaders/actions. Logs once, then renders an isolated UI inside the page
 * layout so the rest of the app shell stays interactive.
 *
 * The global `<ErrorBoundaryProvider>` (in `src/app/providers/`) is a final
 * fallback for catastrophic errors that escape the router — it should rarely
 * fire in practice.
 */
export const RouteErrorBoundary: FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const error: unknown = useRouteError();

  useEffect(() => {
    logger.error({
      event: "ui.route_error",
      path: location.pathname,
      status: error instanceof ApiError ? error.status : undefined,
      message: extractErrorMessage(error)
    });

    Sentry.captureException(error, {
      contexts: {
        route: {
          path: location.pathname,
          status: error instanceof ApiError ? error.status : undefined
        }
      }
    });
  }, [error, location.pathname]);

  const headline = headlineFor(error, t);

  const handleRetry = useCallback((): void => {
    /*
     * A full reload of the current route — re-runs the queryFn and rebuilds
     * the React tree from scratch. Cheaper than `window.location.reload`
     * because the JS bundle and CSS stay warm in the browser cache.
     */
    window.location.assign(location.pathname);
  }, [location.pathname]);

  return (
    <main
      role='alert'
      className='bg-background flex min-h-screen items-center justify-center px-6 py-12'
    >
      <div className='flex w-full max-w-md flex-col gap-6'>
        <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
          {t("app.name")}
        </span>
        <h1 className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'>
          {headline}
        </h1>
        <p className='text-muted-foreground text-base'>
          {t("errors.route.body")}
        </p>
        <div className='flex flex-wrap items-center gap-3'>
          <Button type='button' size='lg' onClick={handleRetry}>
            {t("errors.route.retry")}
          </Button>
          <Button asChild variant='outline' size='lg'>
            <Link to='/'>{t("errors.route.home")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};
