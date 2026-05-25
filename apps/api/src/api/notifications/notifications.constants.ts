/**
 * Read-API pagination bounds. The HTTP route accepts a `limit` query param
 * but caps it server-side so a misbehaving client (or compromised token)
 * can't make us SELECT the entire table.
 */
export const NOTIFICATIONS_MAX_LIMIT = 100;
export const NOTIFICATIONS_DEFAULT_LIMIT = 25;
