import {
  DASHBOARD_ACTIVITY_DEFAULT_LIMIT,
  DASHBOARD_ACTIVITY_MAX_LIMIT,
} from "./dashboard.constants";

/**
 * Format an audit-row action + resource pair into a human-readable
 * activity title for the dashboard feed.
 */
export const formatActivityTitle = (
  action: string,
  resource: string | null
): string => {
  if (resource !== null && resource !== "") {
    return `${action} — ${resource}`;
  }

  return action;
};

/**
 * Parses the `limit` query param for `/dashboard/activity`. Falls back to
 * the feature default on missing/invalid input and caps at the hard max so
 * a misbehaving client can't request a runaway page.
 */
export const parseDashboardLimit = (raw: string | undefined): number => {
  if (raw === undefined || raw === "") {
    return DASHBOARD_ACTIVITY_DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return DASHBOARD_ACTIVITY_DEFAULT_LIMIT;
  }

  return Math.min(parsed, DASHBOARD_ACTIVITY_MAX_LIMIT);
};
