import type { IApiErrorBody } from "./ApiError.types";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;
  public readonly fieldErrors: Record<string, string> | undefined;
  public readonly requestId: string | undefined;

  public constructor(status: number, body: IApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors;
    this.requestId = body.requestId;
  }

  public get isUnauthorized(): boolean {
    return this.status === 401;
  }

  public get isForbidden(): boolean {
    return this.status === 403;
  }

  public get isEmailNotVerified(): boolean {
    return this.code === "EMAIL_NOT_VERIFIED";
  }

  public get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }

  public get isRateLimited(): boolean {
    return this.status === 429;
  }

  public get isServer(): boolean {
    return this.status >= 500;
  }
}
