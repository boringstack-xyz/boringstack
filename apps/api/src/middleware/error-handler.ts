import { env } from "../config/env";
import { logger } from "../config/logger";
import {
  ApiError,
  ApiErrors,
  ElysiaErrorCodes,
  getErrorMessage,
  type IApiErrorResponse,
} from "../lib/errors";

import type { IErrorHandlerArgs } from "./error-handler.types";

const extractFieldErrors = (
  error: unknown
): Record<string, string> | undefined => {
  if (
    error instanceof Error &&
    "field" in error &&
    typeof error.field === "string"
  ) {
    return { [error.field]: getErrorMessage(error) };
  }

  return undefined;
};

const isClientErrorCode = (code: string): boolean =>
  code === ElysiaErrorCodes.NOT_FOUND ||
  code === ElysiaErrorCodes.VALIDATION ||
  code === ElysiaErrorCodes.PARSE ||
  code === ElysiaErrorCodes.INVALID_COOKIE_SIGNATURE;

/*
 * Application-thrown `ApiError`s carry their own statusCode and reach
 * this handler before Elysia gets to tag them with an error code. Any
 * 4xx from the app layer is by definition client-driven (bad input,
 * missing auth, forbidden, conflict) — log at `warn` so it doesn't
 * pollute the error stream alongside genuine 5xx bugs. 5xx still logs
 * at `error`.
 */
const isClientApiError = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.statusCode >= 400 &&
  error.statusCode < 500;

/*
 * Resolve the final HTTP status BEFORE the log line so observability
 * surfaces what the client actually saw. Elysia's `set.status` is the
 * pre-handler default; an `ApiError` overrides it to its own
 * `statusCode`, and Elysia-thrown codes map below.
 */
const resolveFinalStatus = (code: string, error: unknown): number => {
  if (error instanceof ApiError) {
    return error.statusCode;
  }

  switch (code) {
    case ElysiaErrorCodes.NOT_FOUND:
      return 404;
    case ElysiaErrorCodes.VALIDATION:
    case ElysiaErrorCodes.PARSE:
      return 400;
    case ElysiaErrorCodes.INVALID_COOKIE_SIGNATURE:
      return 401;
    default:
      return 500;
  }
};

export const errorHandler = ({
  code,
  error,
  set,
}: IErrorHandlerArgs): IApiErrorResponse => {
  const isClientError = isClientErrorCode(code) || isClientApiError(error);
  const finalStatus = resolveFinalStatus(code, error);

  const basePayload = {
    errorCode: code,
    statusCode: finalStatus,
    message: getErrorMessage(error),
    stack:
      env.isDevelopment && error instanceof Error ? error.stack : undefined,
  };

  if (isClientError) {
    logger.warn(`Client error ${code}`, {
      ...basePayload,
      event: "request.client_error",
    });
  } else {
    logger.error(`Error ${code}`, {
      ...basePayload,
      event: "request.error",
    });
  }

  if (error instanceof ApiError) {
    set.status = finalStatus;

    return error.toResponse();
  }

  set.status = finalStatus;

  let apiError: ApiError;

  switch (code) {
    case ElysiaErrorCodes.NOT_FOUND:
      apiError = ApiErrors.notFound();
      break;
    case ElysiaErrorCodes.VALIDATION:
    case ElysiaErrorCodes.PARSE:
      apiError = ApiErrors.validation(
        getErrorMessage(error),
        extractFieldErrors(error)
      );
      break;
    case ElysiaErrorCodes.INVALID_COOKIE_SIGNATURE:
      /*
       * Elysia's cookie middleware throws this BEFORE auth-route derive
       * code runs when a signed cookie's signature is missing or wrong
       * — i.e. when an attacker sends a tampered or guessed auth cookie.
       * It's untrusted user input, not an internal error.
       */
      apiError = ApiErrors.unauthorized();
      break;
    case ElysiaErrorCodes.INTERNAL_SERVER_ERROR:
    case ElysiaErrorCodes.UNKNOWN:
    default:
      apiError = ApiErrors.internal();
      break;
  }

  return apiError.toResponse();
};
