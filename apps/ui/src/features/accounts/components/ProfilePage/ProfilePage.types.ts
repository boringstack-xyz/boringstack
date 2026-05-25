import type * as React from "react";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

export interface IProfilePageProps {
  readonly className?: string;
}

export interface IProfileFormInput {
  readonly firstName: string;
  readonly lastName: string;
}

export interface IProfilePageView {
  readonly pageTitle: string;
  readonly pageSubtitle: string;
  readonly email: string;
  readonly emailHint: string;
  readonly avatarLabel: string;
  readonly avatarPlaceholder: string;
  readonly firstNameLabel: string;
  readonly lastNameLabel: string;
  readonly emailLabel: string;
  readonly saveLabel: string;
  readonly savingLabel: string;
  readonly saveSuccessLabel: string;
  readonly initials: string;
  readonly register: UseFormRegister<IProfileFormInput>;
  readonly errors: FieldErrors<IProfileFormInput>;
  readonly isSubmitting: boolean;
  readonly submit: (event: React.BaseSyntheticEvent) => void;
}
