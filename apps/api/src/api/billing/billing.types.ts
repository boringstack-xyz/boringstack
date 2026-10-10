import type { BILLING_INTERVALS } from "./billing.constants";

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface IPlanSummary {
  id: number;
  name: string;
  isDefault: boolean;
  /** Intervals a checkout can be started for right now (billing on, price set). */
  purchasableIntervals: BillingInterval[];
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
