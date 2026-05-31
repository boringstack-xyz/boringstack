import { now } from "../time/now";
import type { ErrorCode, IApiErrorResponse } from "./errors.types";

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly fieldErrors: Record<string, string> | undefined;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 500,
    fieldErrors?: Record<string, string>,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }

  toResponse(): IApiErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
        ...(this.fieldErrors !== undefined && {
          fieldErrors: this.fieldErrors,
        }),
        timestamp: now(),
      },
    };
  }
}
