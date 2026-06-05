export const DASHBOARD_QUERY_KEYS = {
  summary: ["dashboard", "summary"] as const,
  activity: ["dashboard", "activity"] as const
};

/*
 * Seed for useInfiniteQuery's cursor pageParam. Declared `string | undefined`
 * so TanStack infers TPageParam correctly; a function-local `undefined` would
 * be control-flow-narrowed to the literal and collapse the type.
 */
export const INITIAL_ACTIVITY_CURSOR: string | undefined = undefined;
