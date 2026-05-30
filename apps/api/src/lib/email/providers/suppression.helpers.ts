import { logger } from "../../../config/logger";
import { maskEmailForLogging } from "../email.utils";
import {
  EMAIL_SUPPRESSION_REASONS,
  type EmailSuppressionProvider,
} from "../suppression.constants";
import { emailSuppressionService } from "../suppression.service";

/**
 * Substrings (case-insensitive) that providers tend to surface when they
 * reject a send because the recipient is on their internal suppression
 * list. Hits here mirror the provider's verdict into our local
 * `email_suppression` table so the next call skips the network entirely.
 *
 * Tuning these is provider-specific maintenance — keep the list narrow
 * to avoid false-positive suppressions when the API just returned a
 * transient error.
 */
const SUPPRESSION_MARKERS = [
  "suppress",
  "suppressed",
  "on suppression list",
  "in the suppression list",
  "recipient address rejected",
  "address is invalid",
] as const;

export const isProviderSuppressionError = (errorBody: string): boolean => {
  const haystack = errorBody.toLowerCase();

  return SUPPRESSION_MARKERS.some((marker) => haystack.includes(marker));
};

/**
 * Mirror a provider-level suppression rejection into our local
 * blocklist. Best-effort: a failure here is logged but never thrown —
 * the caller is about to re-raise its own send error anyway, and a
 * missed mirror row at most costs one extra wasted retry next time.
 */
export const mirrorProviderSuppression = async (
  recipient: string,
  provider: EmailSuppressionProvider,
  detail: string
): Promise<void> => {
  if (recipient === "") {
    return;
  }

  await emailSuppressionService.record({
    email: recipient,
    reason: EMAIL_SUPPRESSION_REASONS.PROVIDER_SUPPRESSED,
    provider,
    metadata: { detail },
  });

  logger.info("Mirrored provider suppression locally", {
    event: "email_suppression.mirrored",
    provider,
    email: maskEmailForLogging(recipient),
  });
};
