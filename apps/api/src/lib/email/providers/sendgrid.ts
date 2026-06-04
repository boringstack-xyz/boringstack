import sgMail from "@sendgrid/mail";
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
import type { ISendGridMailClient } from "./sendgrid.types";

export class SendGridEmailService implements IEmailService {
  public readonly providerName = "sendgrid" as const;
  private readonly client: ISendGridMailClient;

  constructor(apiKey: string, client: ISendGridMailClient = sgMail) {
    this.client = client;
    this.client.setApiKey(apiKey);
  }

  private static extractMessageId(rawHeaders: unknown): string {
    if (
      rawHeaders !== null &&
      typeof rawHeaders === "object" &&
      "x-message-id" in rawHeaders &&
      typeof rawHeaders["x-message-id"] === "string"
    ) {
      return rawHeaders["x-message-id"];
    }

    return "";
  }

  async send(message: IEmailMessage): Promise<IEmailResult> {
    validateEmailMessage(message, env.EMAIL_FROM);
    const recipient = maskEmailForLogging(message.to);

    try {
      return await retryWithBackoff(async () => {
        const [response] = await withEmailTimeout(() =>
          this.client.send({
            from: env.EMAIL_FROM,
            to: message.to,
            subject: message.subject,
            html: message.html,
            ...(message.text !== undefined && { text: message.text }),
          })
        );

        const id = SendGridEmailService.extractMessageId(response.headers);

        logger.info("Email sent via SendGrid", {
          event: "email_sent",
          provider: "sendgrid",
          messageId: id,
          to: recipient,
        });

        return { id, provider: "sendgrid" };
      });
    } catch (error: unknown) {
      const detail = getErrorMessage(error);

      if (isProviderSuppressionError(detail)) {
        await mirrorProviderSuppression(
          message.to,
          EMAIL_SUPPRESSION_PROVIDERS.SENDGRID,
          detail
        );
      }

      logger.error("Failed to send email via SendGrid", {
        event: "email_send_failed",
        provider: "sendgrid",
        to: recipient,
        error: detail,
      });

      throw ApiErrors.externalService("Failed to send email via SendGrid");
    }
  }
}
