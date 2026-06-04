import type { IResolvedRetryOptions } from "./email.types";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * Per-attempt budget for a single provider call. Resend and SendGrid wrap
 * fetch and expose no timeout option, so their send is raced against this
 * via withEmailTimeout; nodemailer applies it natively as
 * connection/socket/greeting timeouts. 10s mirrors the Cloudflare provider.
 */
export const EMAIL_REQUEST_TIMEOUT_MS = 10_000;

export const RETRY_DEFAULTS: IResolvedRetryOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  retryableErrorTypes: [],
};

export const TRANSIENT_NAME_PATTERNS = [
  "network",
  "timeout",
  "econnreset",
  "econnrefused",
  "ratelimit",
];

export const TRANSIENT_MESSAGE_PATTERNS = [
  "network",
  "timeout",
  "connection",
  "429",
  "503",
  "service unavailable",
];
