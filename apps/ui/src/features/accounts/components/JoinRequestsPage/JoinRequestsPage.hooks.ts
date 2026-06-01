import { useCallback, useState } from "react";

import { useMe } from "@/features/auth/Auth.queries";

import {
  useApproveJoinRequest,
  useDenyJoinRequest
} from "../../JoinRequests.mutations";
import { useJoinRequests } from "../../JoinRequests.queries";
import type { IJoinRequestsPageView } from "./JoinRequestsPage.types";

/**
 * Reviewer-side join-request inbox. The account id comes from the
 * active membership in `/me` — the API enforces role on every
 * mutation, so we don't gate the page in the hook; the empty state
 * just renders for accounts where the user isn't an owner/admin.
 */
export function useJoinRequestsPage(): IJoinRequestsPageView {
  const me = useMe();
  const accountId = me.data?.account.id;
  const list = useJoinRequests(accountId);
  const approveMutation = useApproveJoinRequest(accountId);
  const denyMutation = useDenyJoinRequest(accountId);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const onApprove = useCallback(
    (requestId: string): void => {
      setPendingActionId(requestId);
      approveMutation.mutate(
        { requestId },
        {
          onSettled: () => {
            setPendingActionId(null);
          }
        }
      );
    },
    [approveMutation]
  );

  const onDeny = useCallback(
    (requestId: string): void => {
      setPendingActionId(requestId);
      denyMutation.mutate(
        { requestId },
        {
          onSettled: () => {
            setPendingActionId(null);
          }
        }
      );
    },
    [denyMutation]
  );

  return {
    isLoading: me.isPending || list.isPending,
    isError: list.isError,
    requests: list.data ?? [],
    onApprove,
    onDeny,
    pendingActionId
  };
}
