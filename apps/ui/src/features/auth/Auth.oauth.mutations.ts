import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { SESSION_QUERY_KEYS } from "@/lib/session";

export function useDisconnectOAuth(): UseMutationResult<
  void,
  unknown,
  { provider: string }
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      await apiClient.DELETE("/api/v1/auth/oauth/{provider}", {
        params: { path: { provider } }
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: SESSION_QUERY_KEYS.me });
    }
  });
}
