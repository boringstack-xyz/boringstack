import type { BaseSyntheticEvent, ChangeEvent } from "react";

import type { IMfaSetupResponse } from "@/features/auth/Auth.types";

export interface IMfaSectionProps {
  readonly className?: string;
}

/**
 * Four discrete UI states the card flips between. Modeled as a literal
 * union so the .tsx file can render branches without juggling "is this
 * enabled and have I just enrolled" booleans.
 */
export type IMfaUiState =
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "enrolling"; setup: IMfaSetupResponse }
  | { kind: "enabled"; recoveryCodes: string[] | null };

export interface IMfaSectionView {
  readonly state: IMfaUiState;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
  readonly enrollPassword: string;
  readonly verifyCode: string;
  readonly disablePassword: string;
  readonly regeneratePassword: string;
  readonly qrDataUrl: string | null;
  readonly handleEnrollPasswordChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  readonly handleVerifyCodeChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  readonly handleDisablePasswordChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  readonly handleRegeneratePasswordChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  readonly handleStartEnrollmentSubmit: (event: BaseSyntheticEvent) => void;
  readonly handleVerifyEnrollmentSubmit: (event: BaseSyntheticEvent) => void;
  readonly handleRegenerateSubmit: (event: BaseSyntheticEvent) => void;
  readonly handleDisableSubmit: (event: BaseSyntheticEvent) => void;
  readonly onCancelEnrollment: () => void;
  readonly isStarting: boolean;
  readonly isVerifying: boolean;
  readonly isDisabling: boolean;
  readonly isRegenerating: boolean;
  readonly enrollError: string | null;
  readonly verifyError: string | null;
  readonly disableError: string | null;
  readonly regenerateError: string | null;
}

export interface IMfaSubViewProps {
  readonly view: IMfaSectionView;
}

export interface IRecoveryListProps {
  readonly title: string;
  readonly hint: string;
  readonly codes: readonly string[];
  readonly testId?: string;
}
