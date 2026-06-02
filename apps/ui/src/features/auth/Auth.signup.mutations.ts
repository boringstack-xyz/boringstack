import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import type {
  IRegisterInput,
  IResendVerificationInput,
  IVerifyEmailInput
} from "./Auth.types";

/**
 * Server creates only the pending user, hash, and a verification token.
 * No session is issued — the caller must check email and click the link.
 * Resolves with the masked confirmation message returned by the API so
 * the UI can echo "we sent a link to user@x.com" verbatim.
 */
export function useRegister(): UseMutationResult<
  string,
  unknown,
  IRegisterInput
> {
  return useMutation({
    mutationFn: async (input: IRegisterInput) => {
      const { data } = await apiClient.POST("/api/v1/auth/register", {
        body: input
      });

      if (!data?.data) {
        throw new ApiError(0, { message: "Empty register response" });
      }

      const payload: unknown = data.data;
      const message =
        typeof payload === "object" && payload !== null && "message" in payload
          ? Reflect.get(payload, "message")
          : undefined;

      return typeof message === "string" ? message : "";
    }
  });
}

/**
 * Verifies the token, atomically provisions the personal account, and
 * the server sets auth + refresh cookies on the response. Invalidates
 * the `/me` cache so `ProtectedRoute` immediately reflects the new
 * authenticated state.
 */
export function useVerifyEmail(): UseMutationResult<
  void,
  unknown,
  IVerifyEmailInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: IVerifyEmailInput) => {
      await apiClient.POST("/api/v1/auth/verify-email", { body: input });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}

/**
 * Re-issues a verification email. Always succeeds (server returns an
 * enumeration-safe message even for unknown addresses).
 */
export function useResendVerification(): UseMutationResult<
  void,
  unknown,
  IResendVerificationInput
> {
  return useMutation({
    mutationFn: async (input: IResendVerificationInput) => {
      await apiClient.POST("/api/v1/auth/resend-verification", {
        body: input
      });
    }
  });
}
