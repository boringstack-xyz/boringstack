import { useCallback, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { ROLE } from "@/lib/acl/acl.types";
import { ApiError } from "@/lib/api/ApiError";

import { useMe } from "@/features/auth/Auth.queries";

import { useInvitations } from "../../Accounts.queries";
import { inviteMemberSchema } from "../../Accounts.schemas";
import type { IInviteMemberInput } from "../../Accounts.types";
import {
  useInviteMember,
  useResendInvitation,
  useRevokeInvitation
} from "../../Invitations.mutations";
import type {
  IInvitationsLockedReason,
  IInvitationsPageView
} from "./InvitationsPage.types";

export function useInvitationsPage(): IInvitationsPageView {
  const { t } = useTranslation();
  const me = useMe();
  const accountId = me.data?.account.id;

  let lockedReason: IInvitationsLockedReason = null;

  if (me.data != null) {
    if (!me.data.features.can_invite_team) {
      lockedReason = "feature";
    } else if (me.data.role !== ROLE.owner && me.data.role !== ROLE.admin) {
      lockedReason = "role";
    }
  }

  const canInvite = me.data != null && lockedReason === null;

  const invitations = useInvitations(accountId);
  const inviteMutation = useInviteMember(accountId);
  const resendMutation = useResendInvitation(accountId);
  const revokeMutation = useRevokeInvitation(accountId);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<IInviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", roleToAssign: ROLE.member }
  });

  const onSubmit = useCallback((): void => {
    setSubmitError(null);
    void form.handleSubmit((input) => {
      inviteMutation.mutate(input, {
        onSuccess: () => {
          form.reset();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.message !== "") {
            setSubmitError(error.message);

            return;
          }

          setSubmitError(t("accounts.invitations.form.errorGeneric"));
        }
      });
    })();
  }, [form, inviteMutation, t]);

  const onResend = useCallback(
    (invitationId: string): void => {
      resendMutation.mutate({ invitationId });
    },
    [resendMutation]
  );

  const onRevoke = useCallback(
    (invitationId: string): void => {
      revokeMutation.mutate({ invitationId });
    },
    [revokeMutation]
  );

  return {
    canInvite,
    lockedReason,
    accountId,
    isLoading: me.isPending || invitations.isPending,
    invitations: invitations.data ?? [],
    form,
    isSubmitting: inviteMutation.isPending,
    submitError,
    onSubmit,
    onResend,
    onRevoke,
    isResending: resendMutation.isPending,
    isRevoking: revokeMutation.isPending
  };
}
