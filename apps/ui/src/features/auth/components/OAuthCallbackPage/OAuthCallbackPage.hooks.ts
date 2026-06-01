import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";
import { resolveOAuthErrorMessage } from "@/lib/auth/oauth.errors";
import { logger } from "@/lib/logger/logger";

import { syncMeAfterSessionEstablished } from "@/features/auth/Auth.session.sync";

import {
  FAILURE_REDIRECT_PATH,
  POST_OAUTH_PATH
} from "./OAuthCallbackPage.constants";
import type { IOAuthCallbackPageView } from "./OAuthCallbackPage.types";

/**
 * Lands here after the API completes the OAuth exchange server-side and
 * redirects the browser to /oauth/success. The session cookie is already
 * set; the SPA just needs to invalidate the `useMe` query so subsequent
 * reads see the logged-in user, then route to the dashboard.
 *
 * If the IdP redirected the browser back with `?error=...` (user denied,
 * provider downtime), the API surfaces the same query param on the
 * redirect and we render an error state instead of navigating.
 */
export function useOAuthCallbackPage(): IOAuthCallbackPageView {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [status, setStatus] =
    useState<IOAuthCallbackPageView["status"]>("exchanging");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const idpError = searchParams.get("error");

    if (idpError !== null) {
      logger.warn({ event: "oauth.idp_error", error: idpError });
      setStatus("error");
      setErrorMessage(resolveOAuthErrorMessage(idpError, t));

      return undefined;
    }

    /*
     * AbortController-as-cancellation-flag: the linter can't track mutation
     * across the closure boundary, but `signal.aborted` IS reactive to the
     * cleanup function's `controller.abort()` call.
     */
    const controller = new AbortController();

    void (async (): Promise<void> => {
      /*
       * The OAuth callback redirect lands with the session cookie
       * already set. Pre-fetch /me with short retries so the post-
       * navigation ProtectedRoute is a cache hit, not a refetch —
       * the same cookie-commit lag that hits the password login also
       * hits the post-redirect callback. See Auth.session.sync.ts.
       */
      await syncMeAfterSessionEstablished(qc);
      await qc.invalidateQueries({ queryKey: CAPABILITIES_QUERY_KEY });

      if (controller.signal.aborted) {
        return;
      }

      logger.info({ event: "oauth.success" });
      await navigate(POST_OAUTH_PATH, { replace: true });
    })();

    return (): void => {
      controller.abort();
    };
  }, [navigate, qc, searchParams, t]);

  return { status, errorMessage };
}

export { FAILURE_REDIRECT_PATH };
