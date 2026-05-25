export interface IApiErrorBody {
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly requestId?: string;
}
