import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import { unwrapMfaEnvelope } from "./Auth.mfa.utils";
import type { IMfaVerifyChallengeInput } from "./Auth.types";

export function useMfaVerifyLogin(): UseMutationResult<
  unknown,
  unknown,
  IMfaVerifyChallengeInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST("/api/v1/auth/mfa/verify-login", {
        body: input
      });

      return unwrapMfaEnvelope(data);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}

export function useMfaVerifyRecovery(): UseMutationResult<
  unknown,
  unknown,
  IMfaVerifyChallengeInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST(
        "/api/v1/auth/mfa/verify-recovery",
        { body: input }
      );

      return unwrapMfaEnvelope(data);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}
