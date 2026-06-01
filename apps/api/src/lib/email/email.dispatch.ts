import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { getQueueManager } from "../../config/setup";
import { emailService } from "./email.service";
import type { ISendOutcome, ISendTemplateInput } from "./email.types";
import { baseTemplateVariables, maskEmailForLogging } from "./email.utils";
import { emailSuppressionService } from "./suppression.service";
import { emailTemplateService } from "./template.service";

/**
 * Render and dispatch an email immediately on the calling thread.
 *
 * Use this from paths that must observe the send result (e.g. an admin
 * "test email" endpoint) or from inside a worker that's already in the
 * queue's retry envelope.
 *
 * Returns `{ status: "suppressed" }` and skips the provider call when
 * the recipient is on the local blocklist (hard bounce, complaint, or
 * provider-mirrored suppression). The provider is only contacted when
 * the address is clean.
 */
export const sendTemplateNow = async (
  input: ISendTemplateInput
): Promise<ISendOutcome> => {
  const suppression = await emailSuppressionService.isSuppressed(input.to);

  if (suppression !== null) {
    logger.info("Skipping email send — recipient is on suppression list", {
      event: "email_dispatch.suppressed",
      to: maskEmailForLogging(input.to),
      templatePath: input.templatePath,
      reason: suppression.reason,
      provider: suppression.provider,
    });

    return { status: "suppressed", reason: suppression.reason };
  }

  const html = emailTemplateService.render(input.templatePath, {
    ...baseTemplateVariables(),
    subject: input.subject,
    ...input.variables,
  });

  await emailService.send({
    to: input.to,
    subject: input.subject,
    html,
  });

  return { status: "sent" };
};

/**
 * Dispatch an email through the configured pipeline:
 *
 *   - QUEUES_ENABLED=true  → enqueue a BullMQ job (returns `{ status: "queued" }`)
 *   - QUEUES_ENABLED=false → send inline via `sendTemplateNow`
 *
 * Request handlers should always use this — switching deployment topology
 * never requires changing call sites.
 */
export const sendTemplate = async (
  input: ISendTemplateInput
): Promise<ISendOutcome> => {
  if (env.QUEUES_ENABLED) {
    const manager = getQueueManager();

    if (manager !== null) {
      await manager.enqueueEmailDelivery(input);

      return { status: "queued" };
    }

    logger.warn(
      "QUEUES_ENABLED=true but QueueManager is not initialized; sending inline",
      {
        event: "queue_fallback_inline",
        templatePath: input.templatePath,
      }
    );
  }

  return sendTemplateNow(input);
};
