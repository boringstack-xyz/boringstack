import { normalizeEmail } from "./email.utils";
import {
  SINGLE_USE_TEMPLATE_PREFIX,
  SOFT_BOUNCE_LOOKBACK_MS,
} from "./soft-bounce-recovery.constants";
import type {
  IHandledEmail,
  ISoftBounceRecoveryResult,
} from "./soft-bounce-recovery.types";
import { AUDIT_ACTIONS } from "../audit-log/audit-log.constants";
import type { IAuditEventInput } from "../audit-log/audit-log.types";
import type { IEmailDeliveryJobData } from "../../queues/email-delivery/email-delivery.types";

/**
 * The emails to send again once a soft-bounce block on `email` is lifted:
 * those handled from shortly before the block appeared, oldest first. A
 * sign-in email (confirm, reset) goes out once, as its newest copy.
 */
export const emailsToResend = (
  handled: readonly IHandledEmail[],
  email: string,
  blockedAtMs: number
): IEmailDeliveryJobData[] => {
  const address = normalizeEmail(email);
  const since = blockedAtMs - SOFT_BOUNCE_LOOKBACK_MS;
  const due = handled
    .filter(
      (item) =>
        normalizeEmail(item.data.to) === address && item.finishedAtMs >= since
    )
    .sort((first, second) => first.finishedAtMs - second.finishedAtMs);
  const newestSingleUse = new Map<string, IHandledEmail>();

  for (const item of due) {
    if (item.data.templatePath.startsWith(SINGLE_USE_TEMPLATE_PREFIX)) {
      newestSingleUse.set(item.data.templatePath, item);
    }
  }

  return due
    .filter(
      (item) =>
        !item.data.templatePath.startsWith(SINGLE_USE_TEMPLATE_PREFIX) ||
        newestSingleUse.get(item.data.templatePath) === item
    )
    .map((item) => item.data);
};

/**
 * What a recovery run leaves in the audit log. The cluster pings Discord on
 * each of these actions, so a delivery that failed is never silent. Counts
 * only: an address never goes into the audit log.
 */
export const softBounceAuditEvents = (
  result: ISoftBounceRecoveryResult
): IAuditEventInput[] => {
  const events: IAuditEventInput[] = [];

  if (result.lifted > 0) {
    events.push({
      userId: null,
      action: AUDIT_ACTIONS.EMAIL_SOFT_BOUNCE_RECOVERED,
      metadata: { addresses: result.lifted, resent: result.resent },
    });
  }

  if (result.failed > 0) {
    events.push({
      userId: null,
      action: AUDIT_ACTIONS.EMAIL_SOFT_BOUNCE_RECOVERY_FAILED,
      metadata: { addresses: result.failed },
    });
  }

  return events;
};
