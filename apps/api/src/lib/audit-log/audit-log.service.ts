import { desc, eq, like, or } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { auditLog, users } from "../../clients/postgres/schema";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";
import type {
  IAuditEventInput,
  IAuditWriteResult,
  IListForAccountInput,
  IListForAccountResult,
} from "./audit-log.types";

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
        targetAccountId: event.targetAccountId ?? null,
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

  /**
   * Read-side: return the most recent audit entries scoped to a given
   * account. Filter matches either `targetAccountId = accountId` or
   * `resource = 'account:{accountId}'` since the write side uses both
   * conventions across services. Pages newest-first.
   */
  async listForAccount(
    input: IListForAccountInput
  ): Promise<IListForAccountResult> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const resourceMatch = `account:${input.accountId}`;
    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        resource: auditLog.resource,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
        actorUserId: auditLog.userId,
        actorEmail: users.email,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(
        or(
          eq(auditLog.targetAccountId, input.accountId),
          eq(auditLog.resource, resourceMatch),
          like(auditLog.resource, `${resourceMatch}:%`)
        )
      )
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit);

    return { entries: rows };
  }
}

export const auditLogService = new AuditLogService();
