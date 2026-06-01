import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import { unwrapMfaEnvelope } from "./Auth.mfa.utils";
import type {
  IMfaPasswordInput,
  IMfaRecoveryCodesResponse,
  IMfaSetupInput,
  IMfaSetupResponse,
  IMfaVerifySetupInput
} from "./Auth.types";

export function useMfaSetup(): UseMutationResult<
  IMfaSetupResponse,
  unknown,
  IMfaSetupInput
> {
  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST("/api/v1/auth/mfa/setup", {
        body: input
      });

      return unwrapMfaEnvelope<IMfaSetupResponse>(data);
    }
  });
}

export function useMfaVerifySetup(): UseMutationResult<
  unknown,
  unknown,
  IMfaVerifySetupInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST("/api/v1/auth/mfa/verify-setup", {
        body: input
      });

      return unwrapMfaEnvelope(data);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.mfaStatus });
    }
  });
}

export function useMfaDisable(): UseMutationResult<
  unknown,
  unknown,
  IMfaPasswordInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST("/api/v1/auth/mfa/disable", {
        body: input
      });

      return unwrapMfaEnvelope(data);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.mfaStatus });
    }
  });
}

export function useMfaRegenerateRecoveryCodes(): UseMutationResult<
  IMfaRecoveryCodesResponse,
  unknown,
  IMfaPasswordInput
> {
  return useMutation({
    mutationFn: async (input) => {
      const { data } = await apiClient.POST(
        "/api/v1/auth/mfa/regenerate-recovery-codes",
        { body: input }
      );

      return unwrapMfaEnvelope<IMfaRecoveryCodesResponse>(data);
    }
  });
}
