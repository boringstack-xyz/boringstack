import type { UseFormReturn } from "react-hook-form";

import type {
  IInviteMemberInput,
  IPendingInvitation
} from "../../Accounts.types";

export type IInvitationsPageProps = Record<string, never>;

/**
 * Why the invite form is unavailable.
 *
 * - `"feature"` — the active plan doesn't include team invitations
 *   (`can_invite_team` is off). The page shows an upgrade-to-Pro prompt
 *   with a link to billing.
 * - `"role"` — the plan does include invitations, but the current user's
 *   role can't issue them (member/viewer can read teammates, only
 *   owner/admin can invite). The page shows an "ask an admin" message.
 * - `null` — the user can invite. The form renders.
 */
export type IInvitationsLockedReason = "feature" | "role" | null;

export interface IInvitationsPageView {
  readonly canInvite: boolean;
  readonly lockedReason: IInvitationsLockedReason;
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
