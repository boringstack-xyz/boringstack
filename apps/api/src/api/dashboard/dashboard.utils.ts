import {
  DASHBOARD_ACTIVITY_DEFAULT_LIMIT,
  DASHBOARD_ACTIVITY_MAX_LIMIT,
} from "./dashboard.constants";

/**
 * Human-readable label per audit action. The dashboard feed renders
 * `${label} — ${resource}` so end users see "Signed in" instead of
 * "auth.login_success". New actions added to `AUDIT_ACTIONS` should
 * land in this map — the fallback derives a label from the action
 * key, which is readable for new events but never as polished.
 */
const ACTIVITY_LABELS: Record<string, string> = {
  "auth.register": "Registered",
  "auth.login_success": "Signed in",
  "auth.login_failed": "Sign-in failed",
  "auth.login_blocked_unverified": "Sign-in blocked (unverified email)",
  "auth.email_verified": "Email verified",
  "auth.account_provisioned": "Account provisioned",
  "auth.password_reset_requested": "Requested password reset",
  "auth.password_reset_completed": "Reset password",
  "auth.password_changed": "Changed password",
  "auth.oauth_linked": "Connected an OAuth provider",
  "auth.oauth_disconnected": "Disconnected an OAuth provider",
  "auth.verification_resent": "Resent verification email",
  "auth.oauth_login": "Signed in via OAuth",
  "auth.oauth_register": "Registered via OAuth",
  "auth.session_created": "Started a session",
  "auth.session_revoked": "Ended a session",
  "auth.sessions_revoked": "Revoked all sessions",
  "auth.refresh_replay": "Refresh-token replay detected",
  "user.created": "Created a user",
  "user.profile_updated": "Updated profile",
  "account.created": "Created an account",
  "account.updated": "Updated account",
  "account.deleted": "Deleted account",
  "account.hard_deleted": "Hard-deleted account",
  "account.owner_transferred": "Transferred account ownership",
  "account.switched": "Switched account",
  "membership.invited": "Invited a teammate",
  "membership.accepted": "Joined an account",
  "membership.revoked": "Revoked a membership",
  "membership.role_changed": "Changed a member's role",
  "plan.changed": "Changed plan",
  "plan.admin_granted": "Granted a plan",
  "plan.admin_extended": "Extended a plan",
  "feature.override_granted": "Granted a feature override",
  "feature.override_revoked": "Revoked a feature override",
  "billing.checkout_session_created": "Started checkout",
  "billing.portal_session_created": "Opened the billing portal",
  "notification.status_updated": "Updated a notification",
  "notification.mark_all_read": "Marked all notifications read",
  "notification.preferences_updated": "Updated notification preferences",
  "widget.created": "Created a widget",
  "widget.updated": "Updated a widget",
  "widget.deleted": "Deleted a widget",
};

/**
 * Derives a human label from a dot/underscore-separated action key
 * when no entry exists in `ACTIVITY_LABELS`. "comment.replied" →
 * "Comment replied".
 */
const deriveActionLabel = (action: string): string => {
  const words = action.replace(/[._]/g, " ").trim();

  if (words === "") {
    return "Activity";
  }

  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Format an audit-row action + resource pair into a human-readable
 * activity title for the dashboard feed. The action key is translated
 * via `ACTIVITY_LABELS`; the resource (e.g. `widget:abc-123`) is
 * appended verbatim when present so admins can spot the target row.
 */
export const formatActivityTitle = (
  action: string,
  resource: string | null
): string => {
  const label = ACTIVITY_LABELS[action] ?? deriveActionLabel(action);

  if (resource !== null && resource !== "") {
    return `${label} — ${resource}`;
  }

  return label;
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
