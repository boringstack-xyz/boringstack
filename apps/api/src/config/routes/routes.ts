import {
  accountSessionRoutes,
  accountsRoutes,
  invitationAcceptRoutes,
} from "../../api/accounts/accounts.routes";
import adminRoutes from "../../api/admin/admin.routes";
import authRoutes from "../../api/auth/auth.routes";
import billingRoutes from "../../api/billing/billing.routes";
import capabilitiesRoutes from "../../api/capabilities/capabilities.routes";
import dashboardRoutes from "../../api/dashboard/dashboard.routes";
import healthRoutes from "../../api/health/health.routes";
import metricsRoutes from "../../api/health/metrics.routes";
import notificationsRoutes from "../../api/notifications/notifications.routes";
import usersRoutes from "../../api/users/users.routes";
import webhookRoutes from "../../api/webhooks/webhooks.routes";

export const routes = {
  auth: authRoutes,
  users: usersRoutes,
  billing: billingRoutes,
  capabilities: capabilitiesRoutes,
  admin: adminRoutes,
  accounts: accountsRoutes,
  accountSession: accountSessionRoutes,
  invitations: invitationAcceptRoutes,
  dashboard: dashboardRoutes,
  notifications: notificationsRoutes,
  webhooks: webhookRoutes,
  health: healthRoutes,
  metrics: metricsRoutes,
};
