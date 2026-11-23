const MINUTE_MS = 60_000;

/**
 * Cloudflare blocks an address about ten minutes after the first failed
 * attempt, so the email that soft-bounced was sent shortly before the block
 * appeared. Emails to that address finished inside this span before the
 * block, or any time after it, are the ones that may not have arrived.
 */
export const SOFT_BOUNCE_LOOKBACK_MS = 20 * MINUTE_MS;

/** The pause between lifting a block and trying the emails again. */
export const SOFT_BOUNCE_RESEND_DELAY_MS = 5 * MINUTE_MS;

/**
 * One automatic lift per address per day. A mailbox that keeps answering
 * "try later" is left to Cloudflare's own 24-hour block after that.
 */
export const SOFT_BOUNCE_CLAIM_WINDOW_SECONDS = 24 * 3_600;

/** A block older than this is about to lapse anyway and is left alone. */
export const SOFT_BOUNCE_MAX_AGE_MS = 24 * 60 * MINUTE_MS;

/**
 * Sign-in emails carry a one-time link, and asking again replaces it: only
 * the newest of each kind is worth sending again.
 */
export const SINGLE_USE_TEMPLATE_PREFIX = "auth/";
