import type { ErrorCode } from "./errors.types";

/**
 * Codes that Elysia's framework layer surfaces on the `code` field of its
 * `.onError` callback. These are NOT app-level error codes — they're the
 * pre-handler-throw signals (404 from unmatched routes, validation failures
 * from TypeBox, cookie-signature mismatches, etc.). Map them to ApiErrors
 * in the central error handler.
 */
export const ElysiaErrorCodes = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  PARSE: "PARSE",
  INVALID_COOKIE_SIGNATURE: "INVALID_COOKIE_SIGNATURE",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  UNKNOWN: "UNKNOWN",
} as const;

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",

  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  CONFLICT: "CONFLICT",
  RESOURCE_EXISTS: "RESOURCE_EXISTS",
  DOMAIN_CLAIMED: "DOMAIN_CLAIMED",

  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",

  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.VALIDATION_ERROR]: "The provided data is invalid",
  [ErrorCodes.INVALID_INPUT]: "Invalid input provided",
  [ErrorCodes.MISSING_REQUIRED_FIELD]: "Required field is missing",
  [ErrorCodes.UNAUTHORIZED]: "Authentication required",
  [ErrorCodes.INVALID_CREDENTIALS]: "Invalid credentials",
  [ErrorCodes.EMAIL_NOT_VERIFIED]:
    "Verify your email before signing in. Check your inbox or request a new link.",
  [ErrorCodes.TOKEN_EXPIRED]: "Authentication token has expired",
  [ErrorCodes.FORBIDDEN]: "Access denied",
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: "Insufficient permissions",
  [ErrorCodes.NOT_FOUND]: "Resource not found",
  [ErrorCodes.RESOURCE_NOT_FOUND]: "The requested resource was not found",
  [ErrorCodes.CONFLICT]: "Resource conflict",
  [ErrorCodes.RESOURCE_EXISTS]: "Resource already exists",
  [ErrorCodes.DOMAIN_CLAIMED]:
    "Your email domain is already in use by another account. Ask an admin to invite you.",
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: "Too many requests",
  [ErrorCodes.LIMIT_EXCEEDED]: "Plan limit reached",
  [ErrorCodes.INTERNAL_SERVER_ERROR]: "An internal error occurred",
  [ErrorCodes.DATABASE_ERROR]: "Database operation failed",
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: "External service error",
};
