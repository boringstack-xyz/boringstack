/**
 * Server-side cap for the `limit` query param on `/activity` so a misbehaving
 * client can't request a huge page. Default + hard max.
 */
export const DASHBOARD_ACTIVITY_DEFAULT_LIMIT = 20;
export const DASHBOARD_ACTIVITY_MAX_LIMIT = 100;
