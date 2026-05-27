/**
 * Canonical action names. Centralized so analytics queries and admin
 * dashboards can rely on a stable vocabulary; add a new constant here
 * before instrumenting a new event.
 */
export const AUDIT_ACTIONS = {
  AUTH_REGISTER: "auth.register",
  AUTH_LOGIN_SUCCESS: "auth.login_success",
  AUTH_LOGIN_FAILED: "auth.login_failed",
  AUTH_LOGIN_BLOCKED_UNVERIFIED: "auth.login_blocked_unverified",
  AUTH_EMAIL_VERIFIED: "auth.email_verified",
  AUTH_ACCOUNT_PROVISIONED: "auth.account_provisioned",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",
  AUTH_PASSWORD_RESET_COMPLETED: "auth.password_reset_completed",
  AUTH_PASSWORD_CHANGED: "auth.password_changed",
  AUTH_OAUTH_LINKED: "auth.oauth_linked",
  AUTH_OAUTH_DISCONNECTED: "auth.oauth_disconnected",
  AUTH_VERIFICATION_RESENT: "auth.verification_resent",
  AUTH_OAUTH_LOGIN: "auth.oauth_login",
  AUTH_OAUTH_REGISTER: "auth.oauth_register",
  AUTH_OAUTH_AUTHORIZATION_URL_CREATED: "auth.oauth_authorization_url_created",
  AUTH_OAUTH_CALLBACK_COMPLETED: "auth.oauth_callback_completed",
  AUTH_SESSION_CREATED: "auth.session_created",
  AUTH_SESSION_REVOKED: "auth.session_revoked",
  AUTH_SESSIONS_REVOKED: "auth.sessions_revoked",
  /*
   * Replay of an already-rotated refresh token. Triggers full family
   * revocation; alert-worthy because it usually means a token leaked.
   */
  AUTH_REFRESH_REPLAY: "auth.refresh_replay",

  USER_CREATED: "user.created",
  USER_PROFILE_UPDATED: "user.profile_updated",

  ACCOUNT_CREATED: "account.created",
  ACCOUNT_UPDATED: "account.updated",
  ACCOUNT_DELETED: "account.deleted",
  ACCOUNT_HARD_DELETED: "account.hard_deleted",
  ACCOUNT_OWNER_TRANSFERRED: "account.owner_transferred",
  ACCOUNT_SWITCHED: "account.switched",
  ACCOUNT_JOIN_REQUEST_CREATED: "account.join_request_created",
  ACCOUNT_JOIN_REQUEST_APPROVED: "account.join_request_approved",
  ACCOUNT_JOIN_REQUEST_DENIED: "account.join_request_denied",
  ACCOUNT_OWNERSHIP_TRANSFER_INITIATED: "account.ownership_transfer_initiated",
  ACCOUNT_OWNERSHIP_TRANSFER_ACCEPTED: "account.ownership_transfer_accepted",
  ACCOUNT_OWNERSHIP_TRANSFER_DECLINED: "account.ownership_transfer_declined",
  ACCOUNT_OWNERSHIP_TRANSFER_CANCELLED: "account.ownership_transfer_cancelled",

  MEMBERSHIP_INVITED: "membership.invited",
  MEMBERSHIP_ACCEPTED: "membership.accepted",
  MEMBERSHIP_REVOKED: "membership.revoked",
  MEMBERSHIP_ROLE_CHANGED: "membership.role_changed",

  PLAN_CHANGED: "plan.changed",
  PLAN_ADMIN_GRANTED: "plan.admin_granted",
  PLAN_ADMIN_EXTENDED: "plan.admin_extended",

  FEATURE_OVERRIDE_GRANTED: "feature.override_granted",
  FEATURE_OVERRIDE_REVOKED: "feature.override_revoked",

  AUTHZ_PLATFORM_ADMIN_BYPASS: "authz.platform_admin_bypass",

  STRIPE_WEBHOOK_RECEIVED: "stripe.webhook_received",
  STRIPE_RECONCILED: "stripe.reconciled",

  LIMIT_EXCEEDED: "limit.exceeded",

  BILLING_CHECKOUT_SESSION_CREATED: "billing.checkout_session_created",
  BILLING_PORTAL_SESSION_CREATED: "billing.portal_session_created",

  NOTIFICATION_STATUS_UPDATED: "notification.status_updated",
  NOTIFICATION_MARK_ALL_READ: "notification.mark_all_read",
  NOTIFICATION_PREFERENCES_UPDATED: "notification.preferences_updated",
  NOTIFICATION_PUSH_SUBSCRIBED: "notification.push_subscribed",
  NOTIFICATION_PUSH_UNSUBSCRIBED: "notification.push_unsubscribed",

  WIDGET_CREATED: "widget.created",
  WIDGET_UPDATED: "widget.updated",
  WIDGET_DELETED: "widget.deleted",
} as const;
