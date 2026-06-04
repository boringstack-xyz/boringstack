import { createTransport, type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { ApiErrors, getErrorMessage } from "../../errors";
import { EMAIL_REQUEST_TIMEOUT_MS } from "../email.constants";
import type {
  IEmailMessage,
  IEmailResult,
  IEmailService,
} from "../email.types";
import {
  maskEmailForLogging,
  retryWithBackoff,
  validateEmailMessage,
} from "../email.utils";

/**
 * Plain SMTP provider. Primary use case in BoringStack is local development
 * against Mailpit (compose `WITH_MAILPIT=1`, SMTP on `mailpit:1025`), so
 * developers can iterate on email templates and inspect the rendered HTML
 * at http://localhost:8025 without sending real emails.
 *
 * Also works as a production fallback for any RFC-5321 server (Postfix,
 * Postmark, SES via SMTP, etc.). Auth is optional — Mailpit accepts any.
 */
export class SmtpEmailService implements IEmailService {
  public readonly providerName = "smtp" as const;
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(host: string, port: number, user?: string, pass?: string) {
    this.transporter = createTransport({
      host,
      port,
      /*
       * Mailpit and most local catchers use plain TCP; STARTTLS upgrades
       * automatically when the server advertises it. The transporter
       * negotiates correctly for both cases.
       */
      secure: port === 465,
      /*
       * SMTP is synchronous at the protocol level: without explicit budgets
       * an unreachable or stalled server hangs sendMail for the socket
       * lifetime and pins the request worker. Bound connect, greeting, and
       * idle-socket waits to the shared email budget.
       */
      connectionTimeout: EMAIL_REQUEST_TIMEOUT_MS,
      greetingTimeout: EMAIL_REQUEST_TIMEOUT_MS,
      socketTimeout: EMAIL_REQUEST_TIMEOUT_MS,
      auth:
        user !== undefined && user !== "" && pass !== undefined
          ? { user, pass }
          : undefined,
    });
  }

  async send(message: IEmailMessage): Promise<IEmailResult> {
    validateEmailMessage(message, env.EMAIL_FROM);
    const recipient = maskEmailForLogging(message.to);

    try {
      return await retryWithBackoff(async () => {
        const result = await this.transporter.sendMail({
          from: env.EMAIL_FROM,
          to: message.to,
          subject: message.subject,
          html: message.html,
          ...(message.text !== undefined && { text: message.text }),
        });

        logger.info("Email sent via SMTP", {
          event: "email_sent",
          provider: "smtp",
          messageId: result.messageId,
          to: recipient,
        });

        return { id: result.messageId, provider: "smtp" };
      });
    } catch (error: unknown) {
      logger.error("Failed to send email via SMTP", {
        event: "email_send_failed",
        provider: "smtp",
        to: recipient,
        error: getErrorMessage(error),
      });

      throw ApiErrors.externalService("Failed to send email via SMTP");
    }
  }
}
