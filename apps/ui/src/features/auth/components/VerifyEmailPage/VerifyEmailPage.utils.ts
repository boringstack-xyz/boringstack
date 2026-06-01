import type { VerifyEmailStatus } from "./VerifyEmailPage.types";

/**
 * Maps an error status + optional server message to the user-facing
 * copy. Lives in `.utils.ts` so the page component stays
 * single-concern (component-only); also makes the mapping unit
 * testable without rendering.
 */
export function resolveErrorMessage(
  status: VerifyEmailStatus,
  errorMessage: string | null,
  t: (key: string) => string
): string {
  if (status === "missing-token") {
    return t("auth.verifyEmail.missingToken");
  }

  if (status === "invalid-token") {
    return t("auth.verifyEmail.invalidToken");
  }

  return errorMessage ?? t("auth.login.errors.network");
}
