import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";
import { takeReturnTo } from "@/lib/auth/return-to";
import { logger } from "@/lib/logger/logger";

import { syncMeAfterSessionEstablished } from "@/features/auth/Auth.session.sync";

import {
  FAILURE_REDIRECT_PATH,
  POST_VERIFY_PATH
} from "./VerifyEmailPage.constants";
import type {
  IVerifyEmailPageView,
  VerifyEmailStatus
} from "./VerifyEmailPage.types";

type VerifyOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "invalid-token" }
  | {
      readonly kind: "error";
      readonly message: string | null;
      readonly status: number | undefined;
    };

interface IVerifyAttempt {
  readonly token: string;
  readonly outcome: Promise<VerifyOutcome>;
}

/*
 * Runs the single-use verification. Never throws: every failure is folded
 * into a `VerifyOutcome` so the effect can handle it after any remount.
 */
async function verifyToken(
  token: string,
  qc: QueryClient
): Promise<VerifyOutcome> {
  try {
    await apiClient.POST("/api/v1/auth/verify-email", { body: { token } });

    /*
     * verify-email sets the session cookies in the same response;
     * the SPA then redirects to /dashboard. Pre-fetch /me with
     * short retries so the post-redirect ProtectedRoute reads
     * authed data instead of catching the cookie-commit window
     * mid-flight. See Auth.session.sync.ts.
     */
    await syncMeAfterSessionEstablished(qc);

    return { kind: "success" };
  } catch (error) {
    if (error instanceof ApiError && error.isValidation) {
      return { kind: "invalid-token" };
    }

    return {
      kind: "error",
      message: error instanceof Error ? error.message : null,
      status: error instanceof ApiError ? error.status : undefined
    };
  }
}

/**
 * Lands here when the user clicks the verification link from their
 * inbox. The token comes from `?token=` in the URL. We POST it to the
 * API: on success the server sets the auth + refresh cookies, we
 * invalidate `useMe`, and route to `/dashboard`. On failure we surface
 * the right copy so the user can request a fresh link.
 *
 * The verify call is deliberately not wired through TanStack Query's
 * `useMutation`: this page fires exactly once per mount, and any
 * retry should be the user clicking "send another link," not a silent
 * RTK retry.
 *
 * The token is single-use, and React StrictMode runs effects twice in
 * development. The in-flight attempt lives in a ref keyed by token, so
 * the second effect run reuses the first POST instead of spending the
 * token a second time (which would report a successful link as invalid).
 */
export function useVerifyEmailPage(): IVerifyEmailPageView {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<VerifyEmailStatus>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptRef = useRef<IVerifyAttempt | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (token === null || token === "") {
      setStatus("missing-token");

      return undefined;
    }

    const attempt: IVerifyAttempt =
      attemptRef.current?.token === token
        ? attemptRef.current
        : { token, outcome: verifyToken(token, qc) };

    attemptRef.current = attempt;

    let isCancelled = false;

    void attempt.outcome.then(async (outcome): Promise<void> => {
      if (isCancelled) {
        return;
      }

      if (outcome.kind === "success") {
        setStatus("success");
        logger.info({ event: "auth.email_verified" });
        await navigate(takeReturnTo() ?? POST_VERIFY_PATH, { replace: true });

        return;
      }

      if (outcome.kind === "invalid-token") {
        setStatus("invalid-token");
        logger.warn({ event: "auth.email_verify_invalid" });

        return;
      }

      setStatus("error");
      setErrorMessage(outcome.message);
      logger.warn({
        event: "auth.email_verify_failed",
        status: outcome.status
      });
    });

    return (): void => {
      isCancelled = true;
    };
  }, [navigate, qc, searchParams]);

  return { status, errorMessage };
}

export { FAILURE_REDIRECT_PATH };
