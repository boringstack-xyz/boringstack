export interface IErrorHandlerArgs {
  code: string;
  error: unknown;
  set: { status?: number | string };
}
