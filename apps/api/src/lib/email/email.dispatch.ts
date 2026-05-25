import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { getQueueManager } from "../../config/setup";
import { emailService } from "./email.service";
import type { ISendTemplateInput } from "./email.types";
import { baseTemplateVariables } from "./email.utils";
import { emailTemplateService } from "./template.service";

/**
 * Render and dispatch an email immediately on the calling thread.
 *
 * Use this from paths that must observe the send result (e.g. an admin
 * "test email" endpoint) or from inside a worker that's already in the
 * queue's retry envelope.
 */
export const sendTemplateNow = async (
  input: ISendTemplateInput
): Promise<void> => {
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
};

/**
 * Dispatch an email through the configured pipeline:
 *
 *   - QUEUES_ENABLED=true  → enqueue a BullMQ job (returns immediately)
 *   - QUEUES_ENABLED=false → send inline via `sendTemplateNow`
 *
 * Request handlers should always use this — switching deployment topology
 * never requires changing call sites.
 */
export const sendTemplate = async (
  input: ISendTemplateInput
): Promise<void> => {
  if (env.QUEUES_ENABLED) {
    const manager = getQueueManager();

    if (manager !== null) {
      await manager.enqueueEmailDelivery(input);

      return;
    }

    logger.warn(
      "QUEUES_ENABLED=true but QueueManager is not initialized; sending inline",
      {
        event: "queue_fallback_inline",
        templatePath: input.templatePath,
      }
    );
  }

  await sendTemplateNow(input);
};
