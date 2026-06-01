import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";
import { CAPABILITIES_QUERY_KEY } from "@/lib/api/queries/capabilities.constants";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import {
  isLoginUserEnvelope,
  isMfaRequiredEnvelope
} from "./Auth.session.mutations.utils";
import { syncMeAfterSessionEstablished } from "./Auth.session.sync";
import type { ILoginInput, ILoginResponse } from "./Auth.types";

export function useLogin(): UseMutationResult<
  ILoginResponse,
  unknown,
  ILoginInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ILoginInput): Promise<ILoginResponse> => {
      const { data } = await apiClient.POST("/api/v1/auth/login", {
        body: input
      });

      if (!data?.data) {
        throw new ApiError(0, { message: "Empty login response" });
      }

      const payload = data.data;

      if (isMfaRequiredEnvelope(payload)) {
        return {
          kind: "mfa-required",
          challengeToken: payload.challengeToken
        };
      }

      if (isLoginUserEnvelope(payload)) {
        return { kind: "session", user: payload.user };
      }

      throw new ApiError(0, { message: "Unrecognised login response shape" });
    },
    onSuccess: async (result: ILoginResponse) => {
      /*
       * Cookies aren't issued yet on the mfa-required branch; the MFA
       * verify mutation establishes the session.
       */
      if (result.kind === "mfa-required") {
        return;
      }

      /*
       * Pre-fetch /me before the consumer navigates. Chromium under
       * Playwright sometimes lags the Set-Cookie commit behind the
       * login response; without this guard the post-redirect
       * ProtectedRoute reads useMe, the cookie isn't yet in the
       * cookie jar, /me returns {user: null}, and the SPA bounces
       * back to /login. `syncMeAfterSessionEstablished` retries
       * briefly to ride out the commit window and populates the me
       * cache authoritatively so the post-navigation useMe is a
       * cache hit, not a refetch.
       */
      await syncMeAfterSessionEstablished(qc);
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
