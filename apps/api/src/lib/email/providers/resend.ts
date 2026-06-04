import { Resend } from "resend";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { ApiErrors, getErrorMessage } from "../../errors";
import type {
  IEmailMessage,
  IEmailResult,
  IEmailService,
} from "../email.types";
import {
  maskEmailForLogging,
  retryWithBackoff,
  validateEmailMessage,
  withEmailTimeout,
} from "../email.utils";
import { EMAIL_SUPPRESSION_PROVIDERS } from "../suppression.constants";
import {
  isProviderSuppressionError,
  mirrorProviderSuppression,
} from "./suppression.helpers";

export class ResendEmailService implements IEmailService {
  public readonly providerName = "resend" as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: IEmailMessage): Promise<IEmailResult> {
    validateEmailMessage(message, env.EMAIL_FROM);
    const recipient = maskEmailForLogging(message.to);

    try {
      return await retryWithBackoff(async () => {
        const result = await withEmailTimeout(() =>
          this.client.emails.send({
            from: env.EMAIL_FROM,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            ...(message.text !== undefined && { text: message.text }),
          })
        );

        if (result.error !== null) {
          if (isProviderSuppressionError(result.error.message)) {
            await mirrorProviderSuppression(
              message.to,
              EMAIL_SUPPRESSION_PROVIDERS.RESEND,
              result.error.message
            );
          }

          throw ApiErrors.externalService(
            `Resend error: ${result.error.message}`
          );
        }

        const id = result.data.id;

        logger.info("Email sent via Resend", {
          event: "email_sent",
          provider: "resend",
          messageId: id,
          to: recipient,
        });

        return { id, provider: "resend" };
      });
    } catch (error: unknown) {
      logger.error("Failed to send email via Resend", {
        event: "email_send_failed",
        provider: "resend",
        to: recipient,
        error: getErrorMessage(error),
      });

      throw ApiErrors.externalService("Failed to send email via Resend");
    }
  }
}
