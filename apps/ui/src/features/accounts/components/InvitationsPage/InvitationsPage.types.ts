import type { UseFormReturn } from "react-hook-form";

import type {
  IInviteMemberInput,
  IPendingInvitation
} from "../../Accounts.types";

export type IInvitationsPageProps = Record<string, never>;

export interface IInvitationsPageView {
  readonly canInvite: boolean;
  readonly accountId: string | undefined;
  readonly isLoading: boolean;
  readonly invitations: readonly IPendingInvitation[];
  readonly form: UseFormReturn<IInviteMemberInput>;
  readonly isSubmitting: boolean;
  readonly submitError: string | null;
  readonly onSubmit: () => void;
  readonly onResend: (invitationId: string) => void;
  readonly onRevoke: (invitationId: string) => void;
  readonly isResending: boolean;
  readonly isRevoking: boolean;
}
