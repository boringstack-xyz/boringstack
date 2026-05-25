import type { IMembershipSummary } from "@/features/auth/Auth.types";

export interface IAccountSwitcherProps {
  readonly className?: string;
}

export interface IAccountSwitcherView {
  readonly memberships: readonly IMembershipSummary[];
  readonly activeAccountId: string | undefined;
  readonly isSwitching: boolean;
  readonly onSelect: (accountId: string) => void;
}
