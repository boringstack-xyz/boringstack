import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { ApiErrors, getErrorMessage } from "../../errors";
import type {
  IEmailMessage,
  IEmailResult,
  IEmailService,
} from "../email.types";
import {
  formatSender,
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
import { createSendGridClient } from "./sendgrid.client";
import type { ISendGridMailClient } from "./sendgrid.types";

export class SendGridEmailService implements IEmailService {
  public readonly providerName = "sendgrid" as const;
  private readonly client: ISendGridMailClient;

  constructor(
    apiKey: string,
    client: ISendGridMailClient = createSendGridClient()
  ) {
    this.client = client;
    this.client.setApiKey(apiKey);
  }

  private static extractMessageId(rawHeaders: unknown): string {
    return rawHeaders !== null &&
      typeof rawHeaders === "object" &&
      "x-message-id" in rawHeaders &&
      typeof rawHeaders["x-message-id"] === "string"
      ? rawHeaders["x-message-id"]
      : "";
  }

  async send(message: IEmailMessage): Promise<IEmailResult> {
    validateEmailMessage(message, env.EMAIL_FROM);
    const recipient = maskEmailForLogging(message.to);

    try {
      return await retryWithBackoff(async () => {
        const [response] = await withEmailTimeout(() =>
          this.client.send({
            from: formatSender(env.EMAIL_FROM, message.fromName),
            to: message.to,
            subject: message.subject,
            html: message.html,
            ...(message.text !== undefined && { text: message.text }),
            ...(message.replyTo !== undefined && { replyTo: message.replyTo }),
            ...(message.headers !== undefined && { headers: message.headers }),
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
