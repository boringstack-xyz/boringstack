/**
 * Reasons an address can land on the email suppression list.
 *
 *  - `hard_bounce`: receiving MTA refused the message for an
 *    address-level reason (mailbox does not exist, domain has no MX,
 *    blocklisted by the receiver). Permanent.
 *  - `complaint`: recipient reported the message as spam through their
 *    ISP's feedback loop. Treat as permanent unless the user explicitly
 *    re-subscribes.
 *  - `provider_suppressed`: the upstream provider rejected the send
 *    because it had already classified the address as undeliverable on
 *    a prior attempt. Mirrors the provider's verdict locally so the
 *    next caller skips the round-trip. Temporary: see
 *    `PROVIDER_SUPPRESSION_TTL_MS`.
 *  - `manual`: operator-applied entry (CLI, admin tooling). No
 *    automatic upstream signal triggered this row.
 */
export const EMAIL_SUPPRESSION_REASONS = {
  HARD_BOUNCE: "hard_bounce",
  COMPLAINT: "complaint",
  PROVIDER_SUPPRESSED: "provider_suppressed",
  MANUAL: "manual",
} as const;

export type EmailSuppressionReason =
  (typeof EMAIL_SUPPRESSION_REASONS)[keyof typeof EMAIL_SUPPRESSION_REASONS];

export const EMAIL_SUPPRESSION_PROVIDERS = {
  RESEND: "resend",
  SENDGRID: "sendgrid",
  CLOUDFLARE: "cloudflare",
  SMTP: "smtp",
  MANUAL: "manual",
} as const;

export type EmailSuppressionProvider =
  (typeof EMAIL_SUPPRESSION_PROVIDERS)[keyof typeof EMAIL_SUPPRESSION_PROVIDERS];

/**
 * How long a mirrored provider verdict holds. A provider suppresses an
 * address for a soft bounce (the receiving server said "try later" a few
 * times) for a day and then lifts it by itself; a copy that never lapsed
 * would cut that person off from every email, password resets included,
 * for good. After this span the next send goes back to the provider, which
 * refuses it again (and is mirrored again) if its own block still stands.
 */
export const PROVIDER_SUPPRESSION_TTL_MS = 24 * 3_600_000;
