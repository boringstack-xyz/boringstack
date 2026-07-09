import type { IBillingPlan } from "../../Billing.types";

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
}

export interface IBillingPlanRowProps {
  readonly plan: IBillingPlan;
  readonly view: IBillingPageView;
}
