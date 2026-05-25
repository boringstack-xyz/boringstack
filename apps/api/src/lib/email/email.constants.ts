import type { IResolvedRetryOptions } from "./email.types";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
