import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import type {
  IEmailMessage,
  IEmailResult,
  IEmailService,
} from "../email.types";
import { maskEmailForLogging, validateEmailMessage } from "../email.utils";

/**
 * Used in tests / development when no provider key is configured. Never
 * sends; just logs the would-be email so dev tokens / URLs are visible
 * in the application log.
 */
export class NoopEmailService implements IEmailService {
  public readonly providerName = "noop" as const;

  send(message: IEmailMessage): Promise<IEmailResult> {
    validateEmailMessage(message, env.EMAIL_FROM);
    const id = `noop_${String(Date.now())}_${Math.random().toString(36).slice(2, 11)}`;

    logger.info("📧 [noop] email not sent (no provider configured)", {
      event: "email_noop",
      to: maskEmailForLogging(message.to),
      subject: message.subject,
    });

    return Promise.resolve({ id, provider: "noop" });
  }
}
