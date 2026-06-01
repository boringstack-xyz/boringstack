import { type UseMutationResult, useMutation } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import type {
  IBillingCheckoutInput,
  IBillingPortalInput
} from "./Billing.types";

export function useBillingCheckout(): UseMutationResult<
  string,
  unknown,
  IBillingCheckoutInput
> {
  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST(
        "/api/v1/billing/stripe/checkout-session",
        { body: input }
      );

      if (data?.url === undefined || data.url === "") {
        throw new ApiError(0, { message: "Empty checkout URL" });
      }

      return data.url;
    }
  });
}

export function useBillingPortal(): UseMutationResult<
  string,
  unknown,
  IBillingPortalInput
> {
  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST(
        "/api/v1/billing/stripe/portal-session",
        { body: input }
      );

      if (data?.url === undefined || data.url === "") {
        throw new ApiError(0, { message: "Empty portal URL" });
      }

      return data.url;
    }
  });
}
