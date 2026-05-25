import { db } from "../../clients/postgres";
import { auditLog } from "../../clients/postgres/schema";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";
import type { IAuditEventInput, IAuditWriteResult } from "./audit-log.types";

/**
 * Append-only audit log writes. Fire-and-forget by design — a failed
 * insert is logged but never propagated to the caller, because losing an
 * audit row is strictly less bad than failing a real request because of
 * a flaky audit table. Callers should treat `record(...)` as best-effort
 * telemetry, not a transactional guarantee.
 *
 * For sensitive flows that *must* observe the write, await the returned
 * promise and check `success`.
 */
export class AuditLogService {
  async record(event: IAuditEventInput): Promise<IAuditWriteResult> {
    try {
      await db.insert(auditLog).values({
        userId: event.userId,
        action: event.action,
        resource: event.resource ?? null,
        metadata: event.metadata ?? {},
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
      });

      return { success: true };
    } catch (error: unknown) {
      logger.error("Audit log write failed", {
        event: "audit_log_write_failed",
        action: event.action,
        userId: event.userId,
        error: getErrorMessage(error),
      });

      return { success: false };
    }
  }
}

export const auditLogService = new AuditLogService();
