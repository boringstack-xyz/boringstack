import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ApiError } from "@/lib/api/ApiError";
import { logger } from "@/lib/logger/logger";

import {
  useAcceptOwnershipTransfer,
  useDeclineOwnershipTransfer
} from "@/features/accounts/OwnershipTransfers.mutations";

import type {
  IOwnershipTransferPageView,
  OwnershipTransferStatus
} from "./OwnershipTransferAcceptPage.types";

/**
 * Email-link landing for ownership transfers. Unlike invitations we
 * DON'T auto-fire — accepting transfers ownership of a whole account,
 * so a stray click on the email shouldn't perform it. The page renders
 * Accept / Decline buttons and only acts on explicit user input.
 */
export function useOwnershipTransferAcceptPage(): IOwnershipTransferPageView {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<OwnershipTransferStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const acceptMutation = useAcceptOwnershipTransfer();
  const declineMutation = useDeclineOwnershipTransfer();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token === null || token === "") {
      setStatus("missing-token");
    }
  }, [searchParams]);

  const token = searchParams.get("token");

  const run = async (
    action: "accept" | "decline",
    fire: () => Promise<unknown>
  ): Promise<void> => {
    if (token === null || token === "") {
      setStatus("missing-token");

      return;
    }

    setStatus(action === "accept" ? "accepting" : "declining");
    setErrorMessage(null);

    try {
      await fire();

      if (action === "accept") {
        setStatus("accepted");
        logger.info({ event: "accounts.ownership_transfer_accepted" });
      } else {
        setStatus("declined");
        logger.info({ event: "accounts.ownership_transfer_declined" });
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.isValidation || error.status === 404)
      ) {
        setStatus("invalid-token");
        logger.warn({
          event: "accounts.ownership_transfer_invalid",
          action
        });

        return;
      }

      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : null);
      logger.warn({
        event: "accounts.ownership_transfer_failed",
        action,
        status: error instanceof ApiError ? error.status : undefined
      });
    }
  };

  return {
    status,
    errorMessage,
    onAccept: () => {
      if (token !== null && token !== "") {
        void run("accept", () => acceptMutation.mutateAsync({ token }));
      }
    },
    onDecline: () => {
      if (token !== null && token !== "") {
        void run("decline", () => declineMutation.mutateAsync({ token }));
      }
    }
  };
}
