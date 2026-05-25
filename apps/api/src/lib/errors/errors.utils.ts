import { now } from "../time/now";
import type { IApiSuccessResponse } from "./errors.types";

/**
 * Narrow an `unknown` caught error into a readable string.
 *
 * Replaces the duplicated `error instanceof Error ? error.message : String(error)`
 * pattern. Preserves cause chains by appending `cause.message` when present.
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.cause instanceof Error && error.cause.message !== "") {
      return `${error.message} (caused by: ${error.cause.message})`;
    }

    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error === null || error === undefined) {
    return "Unknown error";
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

export const createSuccessResponse = <T>(data: T): IApiSuccessResponse<T> => ({
  success: true,
  data,
  timestamp: now(),
});
