import type { BaseSyntheticEvent } from "react";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { IRegisterInput } from "@/features/auth/Auth.types";

export interface ISignUpPageProps {
  readonly className?: string;
}

export interface ISignUpPageView {
  readonly register: UseFormRegister<IRegisterInput>;
  readonly errors: FieldErrors<IRegisterInput>;
  readonly isSubmitting: boolean;
  readonly submit: (event: BaseSyntheticEvent) => void;
  readonly submittedEmail: string | null;
  readonly onResend: () => void;
  readonly isResending: boolean;
}
