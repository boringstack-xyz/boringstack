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
    field?: string;
    timestamp: string;
  };
}

export interface IApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}
