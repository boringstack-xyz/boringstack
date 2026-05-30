export interface IMfaChallengeFormProps {
  readonly mode: "totp" | "recovery";
  readonly code: string;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly onCodeChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onModeToggle: () => void;
}
