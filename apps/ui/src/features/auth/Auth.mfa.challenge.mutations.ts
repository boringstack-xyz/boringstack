import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { unwrapMfaEnvelope } from "./Auth.mfa.utils";
import { syncMeAfterSessionEstablished } from "./Auth.session.sync";
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
      /*
       * Same cookie-commit race as the password login path — see
       * Auth.session.sync.ts. MFA verify establishes the session
       * cookies; the consumer then navigates to /dashboard. Pre-fetch
       * /me with short retries so the post-navigation ProtectedRoute
       * sees authed data instead of a transient {user: null}.
       */
      await syncMeAfterSessionEstablished(qc);
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
      await syncMeAfterSessionEstablished(qc);
    }
  });
}
