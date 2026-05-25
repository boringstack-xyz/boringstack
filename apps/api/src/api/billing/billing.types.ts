export interface IPlanSummary {
  id: number;
  name: string;
  isDefault: boolean;
}

export type AccountPlanStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "paused"
  | "canceled"
  | "incomplete";

export interface ICheckoutSessionResult {
  url: string;
}

export interface IPortalSessionResult {
  url: string;
}

export interface ISubscriptionSummary {
  planId: number;
  planName: string;
  isDefault: boolean;
  status: string;
  hasStripeSubscription: boolean;
}
