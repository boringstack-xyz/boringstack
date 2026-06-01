/*
 * Ownership-transfer offer lifetime. Long enough that a target user
 * has time to check their email and decide, short enough that an
 * abandoned offer doesn't sit forever blocking the partial unique
 * index. Matches the team-invitation TTL for consistency.
 */
export const OWNERSHIP_TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const OWNERSHIP_TRANSFER_EMAIL_SUBJECT =
  "You have been offered ownership of an account";

export const OWNERSHIP_TRANSFER_TEMPLATE_PATH =
  "accounts/ownership-transfer-initiated";
