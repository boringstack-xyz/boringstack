import { env } from "../../config/env";
import type { IEmailService } from "./email.types";
import { CloudflareEmailService } from "./providers/cloudflare";
import { NoopEmailService } from "./providers/noop";
import { ResendEmailService } from "./providers/resend";
import { SendGridEmailService } from "./providers/sendgrid";
import { SmtpEmailService } from "./providers/smtp";

/**
 * Selects the concrete email provider based on `env.EMAIL_PROVIDER`. When
 * the matching API key (or SMTP host) is empty, falls back to the noop
 * provider — keeps local dev frictionless and tests boot-clean.
 */
export const buildEmailService = (): IEmailService => {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      return env.RESEND_API_KEY === ""
        ? new NoopEmailService()
        : new ResendEmailService(env.RESEND_API_KEY);
    case "sendgrid":
      return env.SENDGRID_API_KEY === ""
        ? new NoopEmailService()
        : new SendGridEmailService(env.SENDGRID_API_KEY);
    case "cloudflare":
      return env.CLOUDFLARE_ACCOUNT_ID === "" ||
        env.CLOUDFLARE_EMAIL_API_TOKEN === ""
        ? new NoopEmailService()
        : new CloudflareEmailService(
            env.CLOUDFLARE_ACCOUNT_ID,
            env.CLOUDFLARE_EMAIL_API_TOKEN
          );
    case "smtp":
      return env.SMTP_HOST === ""
        ? new NoopEmailService()
        : new SmtpEmailService(
            env.SMTP_HOST,
            env.SMTP_PORT,
            env.SMTP_USER,
            env.SMTP_PASS
          );
  }
};
