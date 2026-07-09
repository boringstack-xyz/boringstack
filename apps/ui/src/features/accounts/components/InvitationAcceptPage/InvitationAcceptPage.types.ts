export type InvitationAcceptStatus =
  "accepting" | "success" | "missing-token" | "invalid-token" | "error";

export interface IInvitationAcceptPageView {
  status: InvitationAcceptStatus;
  errorMessage: string | null;
}
