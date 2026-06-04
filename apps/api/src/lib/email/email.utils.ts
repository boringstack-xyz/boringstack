import { env } from "../../config/env";
import { ApiErrors } from "../errors";
import {
  EMAIL_REGEX,
  EMAIL_REQUEST_TIMEOUT_MS,
  RETRY_DEFAULTS,
  TRANSIENT_MESSAGE_PATTERNS,
  TRANSIENT_NAME_PATTERNS,
} from "./email.constants";
import type {
  IEmailMessage,
  IResolvedRetryOptions,
  IRetryOptions,
} from "./email.types";

/*
 * ---------------------------------------------------------------------------
 * Validation + masking
 * ---------------------------------------------------------------------------
 */

export const isValidEmail = (email: string): boolean => {
  if (email.trim().length === 0) {
    return false;
  }

  return EMAIL_REGEX.test(email.trim());
};

/**
 * Canonicalise a recipient or actor email for storage / lookup. Lowercases
 * the entire address (RFC 5321 local-parts are technically case-sensitive,
 * but every mainstream MTA folds them in practice) and strips leading /
 * trailing whitespace.
 *
 * This is the ONE definition. Re-deriving it inside auth services,
 * suppression code, or tests is forbidden — see the
 * `no-duplicate-canonical-helpers` lint-meta rule.
 */
export const normalizeEmail = (email: string): string =>
  email.toLowerCase().trim();

/**
 * Mask a recipient email for safe logging. Examples:
 *   "j@example.com"      -> "***@example.com"
 *   "jane@example.com"   -> "j***e@example.com"
 *   ""                   -> "***"
 */
export const maskEmailForLogging = (email: string): string => {
  if (email === "") {
    return "***";
  }

  const atIndex = email.indexOf("@");

  if (atIndex === -1) {
    return "***";
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (localPart.length <= 2) {
    return `***@${domain}`;
  }

  const first = localPart[0] ?? "";
  const last = localPart[localPart.length - 1] ?? "";

  return `${first}***${last}@${domain}`;
};

/**
 * Boundary validator for outbound email payloads. Throws an `ApiError`
 * with a helpful field name so the error handler maps cleanly to a 400.
 */
export const validateEmailMessage = (
  message: IEmailMessage,
  from: string
): void => {
  if (!isValidEmail(message.to)) {
    throw ApiErrors.validation(
      `Invalid recipient email: ${maskEmailForLogging(message.to)}`,
      "to"
    );
  }

  if (!isValidEmail(from)) {
    throw ApiErrors.internal(`Invalid sender email configured: ${from}`);
  }

  if (message.subject.trim().length === 0) {
    throw ApiErrors.validation("Email subject is required", "subject");
  }

  if (message.html.trim().length === 0) {
    throw ApiErrors.validation("Email HTML body is required", "html");
  }
};

/*
 * ---------------------------------------------------------------------------
 * Retry with backoff (used by every provider's `send`)
 * ---------------------------------------------------------------------------
 */

export const isRetryableError = (
  error: unknown,
  retryableErrorTypes: (new (...args: never[]) => Error)[] = []
): boolean => {
  if (error === null || error === undefined) {
    return false;
  }

  for (const ErrorType of retryableErrorTypes) {
    if (error instanceof ErrorType) {
      return true;
    }
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const name = error.name.toLowerCase();

  if (TRANSIENT_NAME_PATTERNS.some((pattern) => name.includes(pattern))) {
    return true;
  }

  const message = error.message.toLowerCase();

  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) =>
    message.includes(pattern)
  );
};

const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bound a single provider call to an explicit budget. Resend and SendGrid
 * wrap `fetch` and expose no timeout option, so the only way to stop a hung
 * mail upstream from pinning the request worker is to race the send against
 * a timer. The rejection message contains "timeout" so `retryWithBackoff`
 * treats it as transient and retries, mirroring an aborted fetch attempt.
 */
export const withEmailTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number = EMAIL_REQUEST_TIMEOUT_MS
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        ApiErrors.externalService(
          `Email provider timeout after ${String(timeoutMs)}ms`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), guard]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

/**
 * Retry an async function with exponential backoff. Only transient errors
 * (network, timeout, 429, 503) are retried — permanent failures throw on
 * the first attempt so the caller can react quickly.
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  options: IRetryOptions = {}
): Promise<T> => {
  const config: IResolvedRetryOptions = { ...RETRY_DEFAULTS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      if (
        attempt === config.maxRetries ||
        !isRetryableError(error, config.retryableErrorTypes)
      ) {
        throw error;
      }

      const delayMs = config.retryDelayMs * Math.pow(2, attempt);

      await delay(delayMs);
    }
  }

  throw lastError;
};

/*
 * ---------------------------------------------------------------------------
 * Template defaults
 * ---------------------------------------------------------------------------
 */

/**
 * Defaults injected into every template render. Per-call variables merge
 * on top, so callers only pass what's specific to their template.
 */
export const baseTemplateVariables = (): Record<string, unknown> => ({
  appName: env.APP_NAME,
  notificationSettingsUrl: env.NOTIFICATION_SETTINGS_URL,
});
