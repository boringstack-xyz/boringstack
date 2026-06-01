import type * as React from "react";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

export interface IForgotPasswordPageProps {
  readonly className?: string;
}

export interface IForgotPasswordFormInput {
  readonly email: string;
}

export interface IForgotPasswordPageView {
  readonly register: UseFormRegister<IForgotPasswordFormInput>;
  readonly errors: FieldErrors<IForgotPasswordFormInput>;
  readonly isSubmitting: boolean;
  readonly submit: (event: React.BaseSyntheticEvent) => void;
  readonly submittedEmail: string | null;
}
