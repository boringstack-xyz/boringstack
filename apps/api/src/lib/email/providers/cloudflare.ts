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
} from "../email.utils";

/**
 * Sends mail via Cloudflare Email Service (https://developers.cloudflare.com/email-service/).
 * Requires a Workers Paid plan, a Cloudflare-managed sending domain, and an
 * API token with the "Email Sending: Edit" permission. Endpoint is scoped to
 * the account ID, so both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN
 * must be set in production — the env validator enforces this.
 */

export class CloudflareEmailService implements IEmailService {
  public readonly providerName = "cloudflare" as const;
  private readonly endpoint: string;
  private readonly apiToken: string;

  constructor(accountId: string, apiToken: string) {
    this.endpoint = CloudflareEmailService.buildEndpoint(accountId);
    this.apiToken = apiToken;
  }

  private static buildEndpoint(accountId: string): string {
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;
  }

  private static extractMessageId(rawBody: string): string {
    if (rawBody === "") {
      return "";
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawBody);
    } catch {
      /*
       * The API may return non-JSON in pathological edge cases; the send
       * was still accepted at the HTTP layer, so don't fail on body
       * parsing.
       */
      return "";
    }

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "result" in parsed &&
      parsed.result !== null &&
      typeof parsed.result === "object" &&
      "id" in parsed.result &&
      typeof parsed.result.id === "string"
    ) {
      return parsed.result.id;
    }

    return "";
  }

  async send(message: IEmailMessage): Promise<IEmailResult> {
    validateEmailMessage(message, env.EMAIL_FROM);
    const recipient = maskEmailForLogging(message.to);

    try {
      return await retryWithBackoff(async () => {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: message.to,
            subject: message.subject,
            html: message.html,
            ...(message.text !== undefined ? { text: message.text } : {}),
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();

          throw ApiErrors.externalService(
            `Cloudflare Email Service HTTP ${String(response.status)}: ${errBody}`
          );
        }

        const id = CloudflareEmailService.extractMessageId(
          await response.text()
        );

        logger.info("Email sent via Cloudflare Email Service", {
          event: "email_sent",
          provider: "cloudflare",
          messageId: id,
          to: recipient,
        });

        return { id, provider: "cloudflare" };
      });
    } catch (error: unknown) {
      logger.error("Failed to send email via Cloudflare Email Service", {
        event: "email_send_failed",
        provider: "cloudflare",
        to: recipient,
        error: getErrorMessage(error),
      });

      throw ApiErrors.externalService("Failed to send email via Cloudflare");
    }
  }
}
