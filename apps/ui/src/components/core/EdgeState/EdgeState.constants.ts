export const EDGE_STATE_TEST_ID = "edge-state";
export const EDGE_STATE_ACTION_TEST_ID = "edge-state-action";
export const EDGE_STATE_SECONDARY_TEST_ID = "edge-state-secondary";

/* A broken thing or an unreachable server is an alert; work under way, or done, is a status. */
export const EDGE_STATE_ROLES = {
  error: "alert",
  offline: "alert",
  loading: "status",
  success: "status",
  missing: undefined,
  empty: undefined
} as const;
