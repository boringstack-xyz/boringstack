import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger/logger";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";

import {
  FAILURE_REDIRECT_PATH,
  POST_VERIFY_PATH
} from "./VerifyEmailPage.constants";
import type {
  IVerifyEmailPageView,
  VerifyEmailStatus
} from "./VerifyEmailPage.types";

/**
 * Lands here when the user clicks the verification link from their
 * inbox. The token comes from `?token=` in the URL. We POST it to the
 * API: on success the server sets the auth + refresh cookies, we
 * invalidate `useMe`, and route to `/dashboard`. On failure we surface
 * the right copy so the user can request a fresh link.
 *
 * The verify call is deliberately not wired through TanStack Query's
 * `useMutation` — this page fires exactly once per mount, and any
 * retry should be the user clicking "send another link," not a silent
 * RTK retry.
 */
export function useVerifyEmailPage(): IVerifyEmailPageView {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<VerifyEmailStatus>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (token === null || token === "") {
      setStatus("missing-token");

      return undefined;
    }

    const controller = new AbortController();
    const isCancelled = (): boolean => controller.signal.aborted;

    void (async (): Promise<void> => {
      try {
        await apiClient.POST("/api/v1/auth/verify-email", { body: { token } });
        await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });

        if (isCancelled()) {
          return;
        }

        setStatus("success");
        logger.info({ event: "auth.email_verified" });
        await navigate(POST_VERIFY_PATH, { replace: true });
      } catch (error) {
        if (isCancelled()) {
          return;
        }

        if (error instanceof ApiError && error.isValidation) {
          setStatus("invalid-token");
          logger.warn({ event: "auth.email_verify_invalid" });

          return;
        }

        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : null);
        logger.warn({
          event: "auth.email_verify_failed",
          status: error instanceof ApiError ? error.status : undefined
        });
      }
    })();

    return (): void => {
      controller.abort();
    };
  }, [navigate, qc, searchParams]);

  return { status, errorMessage };
}

export { FAILURE_REDIRECT_PATH };
