export interface IOAuthCallbackPageView {
  readonly status: "exchanging" | "error";
  readonly errorMessage: string | null;
}
