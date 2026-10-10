import type { operations } from "@/lib/api/client";

type PlansResponse =
  operations["getApiV1BillingPlans"]["responses"][200]["content"]["application/json"];

type SubscriptionResponse =
  operations["getApiV1BillingSubscription"]["responses"][200]["content"]["application/json"];

export type IBillingPlan = PlansResponse[number];
export type IBillingSubscription = SubscriptionResponse;

export type IBillingInterval = "month" | "year";

export interface IBillingCheckoutInput {
  readonly planId: number;
  /** Omitted for plans that offer only one interval. */
  readonly interval?: IBillingInterval;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface IBillingPortalInput {
  readonly returnUrl: string;
}
