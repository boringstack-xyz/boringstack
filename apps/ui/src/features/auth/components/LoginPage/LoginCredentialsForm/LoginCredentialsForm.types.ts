import type { BaseSyntheticEvent } from "react";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { IOAuthProvider } from "@/lib/auth/oauth.service";

import type { ILoginInput } from "@/features/auth/Auth.types";

export interface ILoginCredentialsFormProps {
  readonly register: UseFormRegister<ILoginInput>;
  readonly errors: FieldErrors<ILoginInput>;
  readonly isSubmitting: boolean;
  readonly submit: (event: BaseSyntheticEvent) => void;
  readonly oauthProviders: IOAuthProvider[];
  readonly oauthButtons: readonly {
    readonly provider: IOAuthProvider;
    readonly labelKey: string;
    readonly onClick: () => void;
  }[];
  readonly oauthPending: IOAuthProvider | null;
  readonly pendingEmail: string | null;
  readonly onResendVerification: () => void;
  readonly isResending: boolean;
}
