import type * as React from "react";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

export interface IResetPasswordPageProps {
  readonly className?: string;
}

export interface IResetPasswordFormInput {
  readonly password: string;
}

export type IResetPasswordState =
  | "missingToken"
  | "form"
  | "success"
  | "invalidToken";

export interface IResetPasswordPageView {
  readonly state: IResetPasswordState;
  readonly register: UseFormRegister<IResetPasswordFormInput>;
  readonly errors: FieldErrors<IResetPasswordFormInput>;
  readonly isSubmitting: boolean;
  readonly submit: (event: React.BaseSyntheticEvent) => void;
}
