import { and, count, desc, eq, lt, or, type SQL } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { auditLog } from "../../clients/postgres/schema";
import { ApiErrors } from "../../lib/errors";
import type { IActivityPage, IDashboardSummary } from "./dashboard.types";
import { formatActivityTitle } from "./dashboard.utils";

export class DashboardService {
  async getSummary(userId: string): Promise<IDashboardSummary> {
    const [eventCountRow] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(eq(auditLog.userId, userId));

    const recent = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        resource: auditLog.resource,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt))
      .limit(5);

    return {
      totalEvents: eventCountRow?.value ?? 0,
      recentActivity: recent.map((row) => ({
        id: row.id,
        title: formatActivityTitle(row.action, row.resource),
        timestamp: row.createdAt,
      })),
    };
  }

  async getActivity(
    userId: string,
    limit: number,
    cursor?: string
  ): Promise<IActivityPage> {
    const filters: SQL[] = [eq(auditLog.userId, userId)];

    if (cursor !== undefined && cursor !== "") {
      const cursorId = cursor.replace(/^cursor:/, "");
      const cursorRow = await db.query.auditLog.findFirst({
        where: and(eq(auditLog.id, cursorId), eq(auditLog.userId, userId)),
      });

      if (cursorRow === undefined) {
        throw ApiErrors.invalidInput(
          "Invalid dashboard activity cursor",
          "cursor"
        );
      }

      const cursorFilter = or(
        lt(auditLog.createdAt, cursorRow.createdAt),
        and(
          eq(auditLog.createdAt, cursorRow.createdAt),
          lt(auditLog.id, cursorRow.id)
        )
      );

      if (cursorFilter !== undefined) {
        filters.push(cursorFilter);
      }
    }

    const where = filters.length === 1 ? filters[0] : and(...filters);

    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        resource: auditLog.resource,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      title: formatActivityTitle(row.action, row.resource),
      timestamp: row.createdAt,
    }));

    const last = items.at(-1);
    const nextCursor =
      rows.length > limit && last !== undefined ? `cursor:${last.id}` : null;

    return { items, nextCursor };
  }
}

export const dashboardService = new DashboardService();
