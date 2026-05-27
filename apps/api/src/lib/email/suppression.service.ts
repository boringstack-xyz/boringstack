import { eq } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { emailSuppression } from "../../clients/postgres/schema";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";
import {
  EMAIL_SUPPRESSION_PROVIDERS,
  EMAIL_SUPPRESSION_REASONS,
  type EmailSuppressionProvider,
  type EmailSuppressionReason,
} from "./suppression.constants";
import { maskEmailForLogging, normalizeEmail } from "./email.utils";
import type {
  IEmailSuppressionEntry,
  IRecordSuppressionInput,
  IRecordSuppressionResult,
} from "./suppression.types";

const toReason = (raw: string): EmailSuppressionReason => {
  switch (raw) {
    case EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE:
      return EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE;
    case EMAIL_SUPPRESSION_REASONS.COMPLAINT:
      return EMAIL_SUPPRESSION_REASONS.COMPLAINT;
    case EMAIL_SUPPRESSION_REASONS.PROVIDER_SUPPRESSED:
      return EMAIL_SUPPRESSION_REASONS.PROVIDER_SUPPRESSED;
    default:
      return EMAIL_SUPPRESSION_REASONS.MANUAL;
  }
};

const toProvider = (raw: string): EmailSuppressionProvider => {
  switch (raw) {
    case EMAIL_SUPPRESSION_PROVIDERS.RESEND:
      return EMAIL_SUPPRESSION_PROVIDERS.RESEND;
    case EMAIL_SUPPRESSION_PROVIDERS.SENDGRID:
      return EMAIL_SUPPRESSION_PROVIDERS.SENDGRID;
    case EMAIL_SUPPRESSION_PROVIDERS.CLOUDFLARE:
      return EMAIL_SUPPRESSION_PROVIDERS.CLOUDFLARE;
    case EMAIL_SUPPRESSION_PROVIDERS.SMTP:
      return EMAIL_SUPPRESSION_PROVIDERS.SMTP;
    default:
      return EMAIL_SUPPRESSION_PROVIDERS.MANUAL;
  }
};

/**
 * Suppression list service. The dispatch path consults `isSuppressed`
 * before every send and short-circuits to a `suppressed` delivery row
 * when a match exists, so the provider is never asked to send to an
 * address that has already produced a hard bounce, a complaint, or a
 * provider-level suppression.
 *
 * Writes are idempotent: a second event for the same address (whether
 * from the same provider or a different one) returns `recorded: false`
 * and leaves the original row untouched. The first verdict wins because
 * downgrading a "complaint" to a later "hard_bounce" would lose the
 * stronger compliance signal.
 *
 * `clear` is used when a user verifies a new primary email address —
 * the new address starts fresh regardless of what happened to it
 * before the verification.
 */
export class EmailSuppressionService {
  async record(
    input: IRecordSuppressionInput
  ): Promise<IRecordSuppressionResult> {
    const email = normalizeEmail(input.email);

    try {
      const [inserted] = await db
        .insert(emailSuppression)
        .values({
          email,
          reason: input.reason,
          provider: input.provider,
          providerMessageId: input.providerMessageId ?? null,
          metadata: input.metadata ?? {},
        })
        .onConflictDoNothing({ target: emailSuppression.email })
        .returning({ id: emailSuppression.id });

      const recorded = inserted !== undefined;

      logger.info("Email suppression recorded", {
        event: recorded
          ? "email_suppression.recorded"
          : "email_suppression.duplicate",
        email: maskEmailForLogging(email),
        provider: input.provider,
        reason: input.reason,
      });

      return { recorded };
    } catch (error: unknown) {
      logger.error("Email suppression write failed", {
        event: "email_suppression.write_failed",
        email: maskEmailForLogging(email),
        provider: input.provider,
        reason: input.reason,
        error: getErrorMessage(error),
      });

      return { recorded: false };
    }
  }

  async isSuppressed(email: string): Promise<IEmailSuppressionEntry | null> {
    const normalized = normalizeEmail(email);

    try {
      const [row] = await db
        .select({
          email: emailSuppression.email,
          reason: emailSuppression.reason,
          provider: emailSuppression.provider,
          providerMessageId: emailSuppression.providerMessageId,
          suppressedAt: emailSuppression.suppressedAt,
        })
        .from(emailSuppression)
        .where(eq(emailSuppression.email, normalized))
        .limit(1);

      if (row === undefined) {
        return null;
      }

      return {
        email: row.email,
        reason: toReason(row.reason),
        provider: toProvider(row.provider),
        providerMessageId: row.providerMessageId,
        suppressedAt: row.suppressedAt,
      };
    } catch (error: unknown) {
      logger.error("Email suppression lookup failed", {
        event: "email_suppression.lookup_failed",
        email: maskEmailForLogging(normalized),
        error: getErrorMessage(error),
      });

      return null;
    }
  }

  async clear(email: string): Promise<{ cleared: boolean }> {
    const normalized = normalizeEmail(email);

    try {
      const result = await db
        .delete(emailSuppression)
        .where(eq(emailSuppression.email, normalized))
        .returning({ id: emailSuppression.id });

      const cleared = result.length > 0;

      if (cleared) {
        logger.info("Email suppression cleared", {
          event: "email_suppression.cleared",
          email: maskEmailForLogging(normalized),
        });
      }

      return { cleared };
    } catch (error: unknown) {
      logger.error("Email suppression clear failed", {
        event: "email_suppression.clear_failed",
        email: maskEmailForLogging(normalized),
        error: getErrorMessage(error),
      });

      return { cleared: false };
    }
  }
}

export const emailSuppressionService = new EmailSuppressionService();
