import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger/logger";

import { AUTH_QUERY_KEYS } from "@/features/auth/Auth.constants";

import {
  FAILURE_REDIRECT_PATH,
  POST_ACCEPT_PATH
} from "./InvitationAcceptPage.constants";
import type {
  IInvitationAcceptPageView,
  InvitationAcceptStatus
} from "./InvitationAcceptPage.types";

/**
 * Email-link landing page for invitations. Auto-fires the accept call
 * because the entire intent of the link is "accept this invitation."
 * The route is wrapped in ProtectedRoute, so the user is already
 * authenticated by the time this hook runs — anonymous clicks land on
 * /login first and come back here with the `?token=...` preserved.
 *
 * Mirrors VerifyEmailPage's "fire once per mount, no RTK retry" shape;
 * a retry on a single-use token would always 4xx after the first call.
 */
export function useInvitationAcceptPage(): IInvitationAcceptPageView {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<InvitationAcceptStatus>("accepting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) {
      return;
    }

    const token = searchParams.get("token");

    if (token === null || token === "") {
      setStatus("missing-token");

      return;
    }

    firedRef.current = true;

    void (async (): Promise<void> => {
      try {
        await apiClient.POST("/api/v1/invitations/accept", {
          body: { token }
        });
        await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
        setStatus("success");
        logger.info({ event: "accounts.invitation_accepted" });
        await navigate(POST_ACCEPT_PATH, { replace: true });
      } catch (error) {
        if (error instanceof ApiError && error.isValidation) {
          setStatus("invalid-token");
          logger.warn({ event: "accounts.invitation_accept_invalid" });

          return;
        }

        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : null);
        logger.warn({
          event: "accounts.invitation_accept_failed",
          status: error instanceof ApiError ? error.status : undefined
        });
      }
    })();
  }, [navigate, qc, searchParams]);

  return { status, errorMessage };
}

export { FAILURE_REDIRECT_PATH };
