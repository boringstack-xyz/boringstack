import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";
import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import type { ILoginInput, ILoginResponse } from "./Auth.types";

export function useLogin(): UseMutationResult<
  ILoginResponse,
  unknown,
  ILoginInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ILoginInput) => {
      const { data } = await apiClient.POST("/api/v1/auth/login", {
        body: input
      });

      if (!data?.data) {
        throw new ApiError(0, { message: "Empty login response" });
      }

      return data.data;
    },
    onSuccess: async () => {
      /*
       * Force a /me refetch instead of seeding from the login response:
       * /me carries memberships + features + role, while the login envelope
       * only carries `{ user }`. Seeding would leave the cache half-filled.
       */
      await qc.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me });
      await qc.invalidateQueries({ queryKey: CAPABILITIES_QUERY_KEY });
    }
  });
}

export function useLogout(): UseMutationResult<undefined, unknown, undefined> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.POST("/api/v1/auth/logout");

      return undefined;
    },
    onSuccess: () => {
      qc.setQueryData(AUTH_QUERY_KEYS.me, null);
      qc.clear();
    }
  });
}
