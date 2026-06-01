export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;
export const REFRESH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const EMAIL_PROVIDER_KEY = "email";

export const TEMPLATE_PATHS = {
  CONFIRM_EMAIL: "auth/confirm-your-email",
  RESET_PASSWORD: "auth/reset-password",
  PASSWORD_CHANGED: "auth/password-changed",
} as const;

export const EMAIL_SUBJECTS = {
  CONFIRM_EMAIL: "Confirm your email address",
  RESET_PASSWORD: "Reset your password",
  PASSWORD_CHANGED: "Your password has been changed",
} as const;

export const ENUMERATION_SAFE_MESSAGES = {
  RESEND_VERIFICATION: "If that email exists, a verification message was sent",
  REQUEST_PASSWORD_RESET: "If that email exists, a reset link was sent",
} as const;
