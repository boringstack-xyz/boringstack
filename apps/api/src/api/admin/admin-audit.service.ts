import { desc, lt } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { auditLog } from "../../clients/postgres/schema";

import type { IAuditFeedInput, IAuditFeedEntry } from "./admin-audit.types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/*
 * Read-only feed of the audit log for the operator dashboard. Deliberately
 * narrower than `auditLogService.listForAccount`: no actor email, name or
 * metadata, so the feed shows what happened and by whom (a user id) without
 * copying personal data into a second place.
 */
export class AdminAuditService {
  async listRecent(input: IAuditFeedInput = {}): Promise<IAuditFeedEntry[]> {
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const before = input.before;

    return db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        resource: auditLog.resource,
        actorUserId: auditLog.userId,
        targetAccountId: auditLog.targetAccountId,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(before === undefined ? undefined : lt(auditLog.createdAt, before))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit);
  }
}

export const adminAuditService = new AdminAuditService();
