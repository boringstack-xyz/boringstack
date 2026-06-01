import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import type { IUpdateProfileInput, IUser } from "./Auth.types";

export function useUpdateProfile(): UseMutationResult<
  IUser,
  unknown,
  IUpdateProfileInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: IUpdateProfileInput) => {
      const { data } = await apiClient.PATCH("/api/v1/users/me", {
        body: input
      });

      if (!data) {
        throw new ApiError(0, { message: "Empty profile response" });
      }

      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
    }
  });
}
