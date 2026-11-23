import { createHash } from "node:crypto";

import { env } from "../../config/env";
import { getQueueManager } from "../../config/setup";
import { dedupService } from "../notifications/dedup.service";
import { nowMs } from "../time/now";
import { normalizeEmail } from "./email.utils";
import { CloudflareSuppressionsClient } from "./providers/cloudflare-suppressions";
import { SOFT_BOUNCE_CLAIM_WINDOW_SECONDS } from "./soft-bounce-recovery.constants";
import { recoverSoftBounces } from "./soft-bounce-recovery";
import type { ISoftBounceRecoveryResult } from "./soft-bounce-recovery.types";
import { emailSuppressionService } from "./suppression.service";

/** The claim is keyed by a digest, so the ledger holds no address. */
const claimKey = (email: string): string =>
  `soft-bounce-recovery:${createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")}`;

/**
 * One recovery pass against the live provider and queues. Null when there
 * is nothing to run against: another provider sends the mail, or the
 * queues are off.
 */
export const runSoftBounceRecovery =
  async (): Promise<ISoftBounceRecoveryResult | null> => {
    const queues = getQueueManager();

    if (
      env.EMAIL_PROVIDER !== "cloudflare" ||
      env.CLOUDFLARE_ACCOUNT_ID === "" ||
      env.CLOUDFLARE_EMAIL_API_TOKEN === "" ||
      queues === null
    ) {
      return null;
    }

    const cloudflare = new CloudflareSuppressionsClient(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_EMAIL_API_TOKEN
    );

    return recoverSoftBounces({
      listSoftBounces: () => cloudflare.listSoftBounces(),
      liftBlock: (id) => cloudflare.remove(id),
      claim: (email) =>
        dedupService.tryClaim({
          dedupKey: claimKey(email),
          windowSeconds: SOFT_BOUNCE_CLAIM_WINDOW_SECONDS,
        }),
      clearLocalSuppression: (email) => emailSuppressionService.clear(email),
      handledEmails: () => queues.handledEmailDeliveries(),
      resend: (data, delayMs) => queues.enqueueEmailDelivery(data, { delayMs }),
      nowMs,
    });
  };
