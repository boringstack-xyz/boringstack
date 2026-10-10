import type { IBillingInterval, IBillingPlan } from "../../Billing.types";

export interface IBillingIntervalOption {
  readonly value: IBillingInterval;
  readonly label: string;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

export type ICheckoutOutcome =
  "idle" | "polling" | "confirmed" | "timed_out" | "cancelled";

export interface IBillingPageProps {
  readonly className?: string;
}

export type IBillingPageState =
  "disabled" | "not_owner" | "loading" | "error" | "ready";

export interface IBillingPageView {
  readonly pageTitle: string;
  readonly pageSubtitle: string;
  readonly state: IBillingPageState;
  readonly disabledMessage: string;
  readonly notOwnerMessage: string;
  readonly errorMessage: string;
  readonly currentPlanLabel: string;
  readonly currentPlanName: string;
  readonly plansHeading: string;
  readonly manageLabel: string;
  readonly managingLabel: string;
  readonly upgradeLabel: string;
  readonly upgradingLabel: string;
  readonly loadingLabel: string;
  readonly defaultBadge: string;
  readonly currentBadge: string;
  readonly plans: readonly IBillingPlan[];
  readonly currentPlanId: number | null;
  readonly hasActiveSubscription: boolean;
  readonly isOwner: boolean;
  readonly onUpgrade: (planId: number) => void;
  readonly onManage: () => void;
  readonly upgradingPlanId: number | null;
  readonly isManaging: boolean;
  readonly showIntervalChoice: boolean;
  readonly intervalGroupLabel: string;
  readonly intervalOptions: readonly IBillingIntervalOption[];
  readonly checkoutOutcome: ICheckoutOutcome;
  readonly checkoutMessage: string | null;
  readonly checkoutRetryLabel: string;
  readonly onRetryConfirmation: () => void;
}

export interface IBillingPlanRowProps {
  readonly plan: IBillingPlan;
  readonly view: IBillingPageView;
}
