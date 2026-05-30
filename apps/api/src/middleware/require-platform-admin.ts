import { requireAuth } from "../api/auth/auth.plugin";
import { logger } from "../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../lib/audit-log";
import { ApiErrors } from "../lib/errors";

/**
 * Gates the route group behind `users.is_platform_admin = true`. Distinct
 * from per-account `admin` (`account_memberships.role = "admin"`): only
 * the BoringStack operator hits this, and every passing request is
 * logged so the forensic trail captures who acted across accounts.
 *
 * @example
 *   const adminRoutes = requirePlatformAdmin()
 *     .get("/queues", ...)
 */
export const requirePlatformAdmin = () =>
  requireAuth().onBeforeHandle(({ user }) => {
    if (user.isPlatformAdmin) {
      logger.info("Platform admin check allowed", {
        event: "authz.platform_admin_bypass",
        userId: user.id,
      });

      void auditLogService.record({
        userId: user.id,
        action: AUDIT_ACTIONS.AUTHZ_PLATFORM_ADMIN_BYPASS,
      });

      return;
    }

    logger.warn("Platform admin check denied", {
      event: "authz_denied",
      userId: user.id,
    });

    throw ApiErrors.forbidden();
  });
