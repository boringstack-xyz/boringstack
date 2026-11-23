import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";
import { maskEmailForLogging } from "./email.utils";
import {
  SOFT_BOUNCE_MAX_AGE_MS,
  SOFT_BOUNCE_RESEND_DELAY_MS,
} from "./soft-bounce-recovery.constants";
import type {
  ISoftBounceRecoveryDeps,
  ISoftBounceRecoveryResult,
} from "./soft-bounce-recovery.types";
import { emailsToResend } from "./soft-bounce-recovery.utils";

/**
 * Gets an email through after a soft bounce. When a mail server answers
 * "try later", Cloudflare retries for about ninety seconds, drops the
 * email and blocks the address for a day; we are told nothing, and a new
 * member's confirmation email is simply gone. This reads Cloudflare's
 * soft-bounce blocks, lifts each one once a day, and queues the emails
 * sent to that address around the block to go out again a few minutes
 * later. A second soft bounce inside the day is left to Cloudflare.
 */
export const recoverSoftBounces = async (
  deps: ISoftBounceRecoveryDeps
): Promise<ISoftBounceRecoveryResult> => {
  const blocks = await deps.listSoftBounces();
  const result: ISoftBounceRecoveryResult = {
    found: blocks.length,
    lifted: 0,
    resent: 0,
    failed: 0,
  };

  for (const block of blocks) {
    const blockedAtMs = Date.parse(block.createdAt);

    if (
      block.readOnly ||
      Number.isNaN(blockedAtMs) ||
      deps.nowMs() - blockedAtMs > SOFT_BOUNCE_MAX_AGE_MS ||
      !(await deps.claim(block.email))
    ) {
      continue;
    }

    try {
      await deps.liftBlock(block.id);
      await deps.clearLocalSuppression(block.email);

      const due = emailsToResend(
        await deps.handledEmails(),
        block.email,
        blockedAtMs
      );

      for (const data of due) {
        await deps.resend(data, SOFT_BOUNCE_RESEND_DELAY_MS);
      }

      result.lifted += 1;
      result.resent += due.length;

      logger.info("Lifted a soft-bounce block and queued its emails again", {
        event: "email_soft_bounce.recovered",
        to: maskEmailForLogging(block.email),
        resent: due.length,
      });
    } catch (error: unknown) {
      result.failed += 1;

      logger.error("Soft-bounce recovery failed for one address", {
        event: "email_soft_bounce.recovery_failed",
        to: maskEmailForLogging(block.email),
        error: getErrorMessage(error),
      });
    }
  }

  return result;
};
