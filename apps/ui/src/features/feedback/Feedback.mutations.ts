import { type UseMutationResult, useMutation } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { recordProductEvent } from "@/lib/privacy/product-events.service";

import type { IAnswerFeedbackInput, TFeedbackMoment } from "./Feedback.types";

/* Resolves true only for the first claim of a moment: show the prompt then. */
export function useClaimFeedbackMoment(): UseMutationResult<
  boolean,
  unknown,
  TFeedbackMoment
> {
  return useMutation<boolean, unknown, TFeedbackMoment>({
    mutationFn: async (moment) => {
      const { data } = await apiClient.POST("/api/v1/feedback/{moment}/show", {
        params: { path: { moment } }
      });

      return data?.show === true;
    }
  });
}

export function useAnswerFeedback(): UseMutationResult<
  unknown,
  unknown,
  IAnswerFeedbackInput
> {
  return useMutation<unknown, unknown, IAnswerFeedbackInput>({
    mutationFn: async ({ moment, answer, dismissed }) => {
      await apiClient.PUT("/api/v1/feedback/{moment}", {
        params: { path: { moment } },
        body: { answer, dismissed }
      });

      if (!dismissed) {
        recordProductEvent("feedback_given");
      }

      return undefined;
    }
  });
}
