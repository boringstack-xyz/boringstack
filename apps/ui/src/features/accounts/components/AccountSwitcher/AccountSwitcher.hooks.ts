import { useCallback } from "react";

import { useMe } from "@/features/auth/Auth.queries";

import { useSwitchAccount } from "../../Memberships.mutations";
import type { IAccountSwitcherView } from "./AccountSwitcher.types";

export function useAccountSwitcher(): IAccountSwitcherView {
  const me = useMe();
  const switchAccount = useSwitchAccount();
  const activeAccountId = me.data?.account.id;

  const onSelect = useCallback(
    (accountId: string): void => {
      if (accountId === activeAccountId) {
        return;
      }

      switchAccount.mutate({ accountId });
    },
    [switchAccount, activeAccountId]
  );

  return {
    memberships: me.data?.memberships ?? [],
    activeAccountId,
    isSwitching: switchAccount.isPending,
    onSelect
  };
}
