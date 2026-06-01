export type OwnershipTransferStatus =
  | "idle"
  | "accepting"
  | "declining"
  | "accepted"
  | "declined"
  | "missing-token"
  | "invalid-token"
  | "error";

export interface IOwnershipTransferPageView {
  status: OwnershipTransferStatus;
  errorMessage: string | null;
  onAccept: () => void;
  onDecline: () => void;
}
