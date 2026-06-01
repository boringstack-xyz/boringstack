import type { InvitationAcceptStatus } from "./InvitationAcceptPage.types";

export function resolveErrorMessage(
  status: InvitationAcceptStatus,
  errorMessage: string | null,
  t: (key: string) => string
): string {
  if (status === "missing-token") {
    return t("accounts.invitations.accept.missingToken");
  }

  if (status === "invalid-token") {
    return t("accounts.invitations.accept.errorInvalid");
  }

  return errorMessage ?? t("accounts.invitations.accept.errorGeneric");
}
