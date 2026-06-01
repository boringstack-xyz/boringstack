import { env } from "../../config/env";
import { isOwnerRole } from "../../lib/acl";
import { ApiErrors } from "../../lib/errors";
import { resolveFreshMembership } from "../../middleware/require-active-membership";

const FRONTEND_ORIGIN = new URL(env.FRONTEND_URL).origin;

export const resolveBillingAccount = async (
  userId: string,
  accountId: string
): Promise<string> => {
  const membership = await resolveFreshMembership(userId, accountId);

  if (!isOwnerRole(membership.role)) {
    throw ApiErrors.forbidden(
      "Only an account owner can manage billing for that account"
    );
  }

  return membership.accountId;
};

/**
 * Stripe-hosted flows should only send users back to the app we control.
 * Accepting arbitrary URLs here turns checkout/portal into an open redirect.
 */
export const assertAllowedBillingRedirectUrl = (
  value: string,
  field: string
): void => {
  try {
    const parsed = new URL(value);

    if (parsed.origin === FRONTEND_ORIGIN) {
      return;
    }
  } catch {
    throw ApiErrors.validation("Invalid billing redirect URL", field);
  }

  throw ApiErrors.validation(
    "Billing redirect URL must use the configured frontend origin",
    field
  );
};
