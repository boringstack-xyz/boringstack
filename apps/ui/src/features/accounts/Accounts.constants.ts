/**
 * Query keys for the accounts + invitations slices. Paths are not
 * duplicated here; the typed `apiClient` consumes them directly from
 * the OpenAPI spec in each query/mutation.
 */
export const ACCOUNTS_QUERY_KEYS = {
  invitations: (accountId: string) =>
    ["accounts", accountId, "invitations"] as const
};
