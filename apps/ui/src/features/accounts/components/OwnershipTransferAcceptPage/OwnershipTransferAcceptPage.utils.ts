import type { OwnershipTransferStatus } from "./OwnershipTransferAcceptPage.types";

export function resolveStatusMessage(
  status: OwnershipTransferStatus,
  errorMessage: string | null,
  t: (key: string) => string
): string {
  switch (status) {
    case "missing-token":
      return t("accounts.ownershipTransfer.missingToken");
    case "invalid-token":
      return t("accounts.ownershipTransfer.errorInvalid");
    case "accepted":
      return t("accounts.ownershipTransfer.successAccepted");
    case "declined":
      return t("accounts.ownershipTransfer.successDeclined");
    case "error":
      return errorMessage ?? t("accounts.ownershipTransfer.errorGeneric");
    case "idle":
    case "accepting":
    case "declining":
    default:
      return t("accounts.ownershipTransfer.intro");
  }
}
