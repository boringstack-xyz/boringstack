import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiErrors } from "../errors";
import type { IEmailService } from "./email.types";
import { CloudflareEmailService } from "./providers/cloudflare";
import { NoopEmailService } from "./providers/noop";
import { ResendEmailService } from "./providers/resend";
import { SendGridEmailService } from "./providers/sendgrid";
import { SmtpEmailService } from "./providers/smtp";

/**
 * A provider was selected via `EMAIL_PROVIDER` but its credential is empty.
 * In production that means transactional mail (verification, password
 * reset, billing) would silently vanish — so fail closed at boot. In dev
 * and test, warn and fall back to the noop provider so local work and the
 * suite stay frictionless.
 */
export const resolveMissingCredential = (
  isProduction: boolean,
  provider: string,
  missingVar: string
): IEmailService => {
  if (isProduction) {
    throw ApiErrors.internal(
      `EMAIL_PROVIDER=${provider} but ${missingVar} is empty — refusing to boot with a silently disabled mailer in production. Set ${missingVar}, or set EMAIL_PROVIDER to a configured provider.`
    );
  }

  logger.warn("Email provider missing credentials; using noop", {
    event: "email.provider_fallback_noop",
    provider,
    missing: missingVar,
  });

  return new NoopEmailService();
};

const noopOrFailClosed = (
  provider: string,
  missingVar: string
): IEmailService =>
  resolveMissingCredential(env.NODE_ENV === "production", provider, missingVar);

/**
 * Selects the concrete email provider based on `env.EMAIL_PROVIDER`. When
 * the matching API key (or SMTP host) is empty, fails closed in production
 * and falls back to the noop provider (with a warning) in dev/test.
 */
export const buildEmailService = (): IEmailService => {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      return env.RESEND_API_KEY === ""
        ? noopOrFailClosed("resend", "RESEND_API_KEY")
        : new ResendEmailService(env.RESEND_API_KEY);
    case "sendgrid":
      return env.SENDGRID_API_KEY === ""
        ? noopOrFailClosed("sendgrid", "SENDGRID_API_KEY")
        : new SendGridEmailService(env.SENDGRID_API_KEY);
    case "cloudflare":
      if (env.CLOUDFLARE_ACCOUNT_ID === "") {
        return noopOrFailClosed("cloudflare", "CLOUDFLARE_ACCOUNT_ID");
      }

      return env.CLOUDFLARE_EMAIL_API_TOKEN === ""
        ? noopOrFailClosed("cloudflare", "CLOUDFLARE_EMAIL_API_TOKEN")
        : new CloudflareEmailService(
            env.CLOUDFLARE_ACCOUNT_ID,
            env.CLOUDFLARE_EMAIL_API_TOKEN
          );
    case "smtp":
      return env.SMTP_HOST === ""
        ? noopOrFailClosed("smtp", "SMTP_HOST")
        : new SmtpEmailService(
            env.SMTP_HOST,
            env.SMTP_PORT,
            env.SMTP_USER,
            env.SMTP_PASS
          );
  }
};
