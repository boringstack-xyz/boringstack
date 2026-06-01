import { ApiError } from "./api-error";
import { ErrorCodes, ErrorMessages } from "./errors.constants";

/**
 * Curated factory functions for every standard API error.
 *
 * Services should always throw via `ApiErrors.*` so the route-level
 * error handler can map cleanly to a typed response with the right
 * HTTP status. Don't `throw new Error(...)` from a service.
 *
 * Single-field validation errors take a `field` string for ergonomics;
 * the factory transparently lifts it into a one-key `fieldErrors` map
 * so the response envelope is shape-consistent regardless of how many
 * fields the error references. Pass an explicit map to `validation()`
 * for multi-field cases.
 */
const singletonMap = (
  field: string,
  message: string
): Record<string, string> => ({ [field]: message });

export const ApiErrors = {
  validation: (
    message: string,
    fieldOrErrors?: string | Record<string, string>,
    details?: Record<string, unknown>
  ): ApiError => {
    const fieldErrors =
      typeof fieldOrErrors === "string"
        ? singletonMap(fieldOrErrors, message)
        : fieldOrErrors;

    return new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      message,
      400,
      fieldErrors,
      details
    );
  },

  invalidInput: (message: string, field?: string): ApiError =>
    new ApiError(
      ErrorCodes.INVALID_INPUT,
      message,
      400,
      field === undefined ? undefined : singletonMap(field, message)
    ),

  missingField: (field: string): ApiError => {
    const message = `Field '${field}' is required`;

    return new ApiError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      message,
      400,
      singletonMap(field, message)
    );
  },

  unauthorized: (
    message: string = ErrorMessages[ErrorCodes.UNAUTHORIZED]
  ): ApiError => new ApiError(ErrorCodes.UNAUTHORIZED, message, 401),

  invalidCredentials: (
    message: string = ErrorMessages[ErrorCodes.INVALID_CREDENTIALS]
  ): ApiError => new ApiError(ErrorCodes.INVALID_CREDENTIALS, message, 401),

  emailNotVerified: (
    message: string = ErrorMessages[ErrorCodes.EMAIL_NOT_VERIFIED]
  ): ApiError => new ApiError(ErrorCodes.EMAIL_NOT_VERIFIED, message, 403),

  tokenExpired: (
    message: string = ErrorMessages[ErrorCodes.TOKEN_EXPIRED]
  ): ApiError => new ApiError(ErrorCodes.TOKEN_EXPIRED, message, 401),

  forbidden: (
    message: string = ErrorMessages[ErrorCodes.FORBIDDEN]
  ): ApiError => new ApiError(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (resource = "Resource"): ApiError =>
    new ApiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),

  conflict: (message: string): ApiError =>
    new ApiError(ErrorCodes.CONFLICT, message, 409),

  domainClaimed: (
    accountName: string,
    details?: Record<string, unknown>
  ): ApiError =>
    new ApiError(
      ErrorCodes.DOMAIN_CLAIMED,
      `Your email domain is already in use by "${accountName}". Ask an admin to invite you.`,
      409,
      undefined,
      details
    ),

  rateLimit: (
    message: string = ErrorMessages[ErrorCodes.RATE_LIMIT_EXCEEDED]
  ): ApiError => new ApiError(ErrorCodes.RATE_LIMIT_EXCEEDED, message, 429),

  /*
   * Plan-limit errors don't carry per-field validation — the `feature`
   * surfaces in `details` so the UI's pricing/upgrade prompt can read
   * it without trying to interpret it as a form field.
   */
  limitExceeded: (
    feature: string,
    details: { current: number; limit: number }
  ): ApiError =>
    new ApiError(
      ErrorCodes.LIMIT_EXCEEDED,
      `Plan limit reached for ${feature}`,
      402,
      undefined,
      { ...details, feature }
    ),

  internal: (
    message: string = ErrorMessages[ErrorCodes.INTERNAL_SERVER_ERROR]
  ): ApiError => new ApiError(ErrorCodes.INTERNAL_SERVER_ERROR, message, 500),

  database: (
    message: string = ErrorMessages[ErrorCodes.DATABASE_ERROR]
  ): ApiError => new ApiError(ErrorCodes.DATABASE_ERROR, message, 500),

  externalService: (
    message: string = ErrorMessages[ErrorCodes.EXTERNAL_SERVICE_ERROR]
  ): ApiError => new ApiError(ErrorCodes.EXTERNAL_SERVICE_ERROR, message, 502),

  notImplemented: (
    message: string = ErrorMessages[ErrorCodes.NOT_IMPLEMENTED]
  ): ApiError => new ApiError(ErrorCodes.NOT_IMPLEMENTED, message, 501),
};
