/**
 * Query key of the current session (`/api/v1/users/me`). Every feature
 * that reads the current user goes through `useMe`; every mutation that
 * changes the session invalidates this key.
 */
export const SESSION_QUERY_KEYS = {
  me: ["auth", "me"] as const
};
