import type * as React from "react";

import type {
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister
} from "react-hook-form";

import type { IOAuthProvider } from "@/lib/auth/oauth.service";

import type { ILoginInput } from "@/features/auth/Auth.types";

export interface ILoginPageProps {
  readonly redirectTo?: string;
}

export interface ILoginOAuthButton {
  readonly provider: IOAuthProvider;
  readonly labelKey: string;
  readonly onClick: () => void;
}

export interface ILoginPageView {
  readonly register: UseFormRegister<ILoginInput>;
  readonly handleSubmit: UseFormHandleSubmit<ILoginInput>;
  readonly errors: FieldErrors<ILoginInput>;
  readonly isSubmitting: boolean;
  readonly onSubmit: (input: ILoginInput) => Promise<void>;
  readonly submit: (event: React.BaseSyntheticEvent) => void;
  readonly onOAuth: (provider: IOAuthProvider) => void;
  readonly onGoogle: () => void;
  readonly onGithub: () => void;
  readonly onLinkedin: () => void;
  readonly oauthProviders: IOAuthProvider[];
  readonly oauthButtons: ILoginOAuthButton[];
  readonly oauthPending: IOAuthProvider | null;
  readonly isGoogleOAuthEnabled: boolean;
  readonly isGithubOAuthEnabled: boolean;
  readonly isLinkedinOAuthEnabled: boolean;
  /**
   * Set after a login attempt with valid credentials but unverified
   * email. Holds the email the user just submitted so the page can
   * render a "we'll resend the link" CTA pinned to that address.
   */
  readonly pendingEmail: string | null;
  readonly onResendVerification: () => void;
  readonly isResending: boolean;
  /**
   * Set when the password is correct but the user has MFA enabled. The
   * SPA holds an opaque challenge token; the user must enter a 6-digit
   * TOTP code (or a recovery code) to receive the session cookies.
   */
  readonly mfaChallengeToken: string | null;
  readonly mfaCode: string;
  readonly onMfaCodeChange: (value: string) => void;
  readonly onMfaSubmit: () => void;
  readonly isMfaSubmitting: boolean;
  readonly mfaError: string | null;
  readonly mfaMode: "totp" | "recovery";
  readonly onMfaModeToggle: () => void;
}
