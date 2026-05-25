import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { BILLING_QUERY_KEYS } from "./Billing.constants";
import type { IBillingPlan, IBillingSubscription } from "./Billing.types";

export function useBillingPlans(
  enabled: boolean
): UseQueryResult<IBillingPlan[]> {
  return useQuery({
    queryKey: BILLING_QUERY_KEYS.plans,
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/billing/plans");

      return data ?? [];
    }
  });
}

export function useBillingSubscription(
  enabled: boolean
): UseQueryResult<IBillingSubscription> {
  return useQuery({
    queryKey: BILLING_QUERY_KEYS.subscription,
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/v1/billing/subscription");

      if (data === undefined) {
        throw new Error("Missing billing subscription payload");
      }

      return data;
    }
  });
}
