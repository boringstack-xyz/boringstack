import { type UseMutationResult, useMutation } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import type {
  IChangePasswordInput,
  IForgotPasswordInput,
  IResetPasswordInput
} from "./Auth.types";

export function useForgotPassword(): UseMutationResult<
  void,
  unknown,
  IForgotPasswordInput
> {
  return useMutation({
    mutationFn: async (input: IForgotPasswordInput) => {
      const { data } = await apiClient.POST("/api/v1/auth/forgot-password", {
        body: input
      });

      if (!data?.success) {
        throw new ApiError(0, { message: "Forgot password request failed" });
      }
    }
  });
}

export function useResetPassword(): UseMutationResult<
  void,
  unknown,
  IResetPasswordInput
> {
  return useMutation({
    mutationFn: async (input: IResetPasswordInput) => {
      const { data } = await apiClient.POST("/api/v1/auth/reset-password", {
        body: input
      });

      if (!data?.success) {
        throw new ApiError(0, { message: "Password reset failed" });
      }
    }
  });
}

export function useChangePassword(): UseMutationResult<
  void,
  unknown,
  IChangePasswordInput
> {
  return useMutation({
    mutationFn: async (input: IChangePasswordInput) => {
      const { data } = await apiClient.POST("/api/v1/auth/change-password", {
        body: input
      });

      if (!data?.success) {
        throw new ApiError(0, { message: "Change password request failed" });
      }
    }
  });
}
