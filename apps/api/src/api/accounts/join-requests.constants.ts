export const JOIN_REQUEST_STATUS = {
  pending: "pending",
  approved: "approved",
  denied: "denied",
} as const;

export const JOIN_REQUEST_EMAIL_SUBJECT =
  "Someone is requesting to join your account";

export const JOIN_REQUEST_TEMPLATE_PATH = "accounts/join-request-created";
