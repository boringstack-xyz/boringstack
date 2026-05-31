import type { ElysiaErrorCodes, ErrorCodes } from "./errors.constants";

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type ElysiaErrorCode =
  (typeof ElysiaErrorCodes)[keyof typeof ElysiaErrorCodes];

export interface IApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    /*
     * Per-field validation messages keyed by form field name. The UI's
     * form layer (`applyServerErrors` in `apps/ui/src/features/.../*.utils.ts`)
     * iterates this map and attaches each message to the matching input.
     * Singular field-level errors set a one-key map; multi-field
     * validation (e.g. password confirmation mismatch + email format)
     * sets multiple entries in a single response.
     */
    fieldErrors?: Record<string, string>;
    timestamp: string;
  };
}

export interface IApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}
