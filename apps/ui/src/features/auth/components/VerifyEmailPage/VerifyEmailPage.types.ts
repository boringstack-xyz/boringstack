export type VerifyEmailStatus =
  "verifying" | "success" | "missing-token" | "invalid-token" | "error";

export interface IVerifyEmailPageView {
  readonly status: VerifyEmailStatus;
  readonly errorMessage: string | null;
}
