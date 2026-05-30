import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import {
  AUDIT_LOG_DEFAULT_LIMIT,
  AUDIT_LOG_QUERY_KEYS
} from "./AuditLog.constants";
import type { IAuditLogListResponse } from "./AuditLog.types";

/**
 * Fetch the audit-log entries for the given account. `accountId` is
 * `undefined` while the active account is still resolving (e.g. on
 * first paint); the query stays disabled until a real id arrives.
 *
 * Caller passes the account id (typically from a sibling hook that
 * reads `useMe`) so this query stays decoupled from the auth feature
 * — the `no-cross-feature-imports` rule keeps barrel coupling out of
 * the audit-log surface.
 */
export function useAuditLog(
  accountId: string | undefined,
  limit: number = AUDIT_LOG_DEFAULT_LIMIT
): UseQueryResult<IAuditLogListResponse> {
  return useQuery({
    queryKey: [...AUDIT_LOG_QUERY_KEYS.list, accountId, limit] as const,
    enabled: typeof accountId === "string",
    queryFn: async () => {
      if (typeof accountId !== "string") {
        throw new ApiError(0, { message: "No active account" });
      }

      const { data } = await apiClient.GET("/api/v1/accounts/{id}/audit-log", {
        params: {
          path: { id: accountId },
          query: { limit }
        }
      });

      if (!data) {
        throw new ApiError(0, { message: "Empty audit-log response" });
      }

      return data;
    }
  });
}
