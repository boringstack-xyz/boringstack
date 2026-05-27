import { ApiError } from "./api-error";
import { ErrorCodes, ErrorMessages } from "./errors.constants";

/**
 * Curated factory functions for every standard API error.
 *
 * Services should always throw via `ApiErrors.*` so the route-level
 * error handler can map cleanly to a typed response with the right
 * HTTP status. Don't `throw new Error(...)` from a service.
 */
export const ApiErrors = {
  validation: (
    message: string,
    field?: string,
    details?: Record<string, unknown>
  ): ApiError =>
    new ApiError(ErrorCodes.VALIDATION_ERROR, message, 400, field, details),

  invalidInput: (message: string, field?: string): ApiError =>
    new ApiError(ErrorCodes.INVALID_INPUT, message, 400, field),

  missingField: (field: string): ApiError =>
    new ApiError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      `Field '${field}' is required`,
      400,
      field
    ),

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

  limitExceeded: (
    feature: string,
    details: { current: number; limit: number }
  ): ApiError =>
    new ApiError(
      ErrorCodes.LIMIT_EXCEEDED,
      `Plan limit reached for ${feature}`,
      402,
      feature,
      details
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
