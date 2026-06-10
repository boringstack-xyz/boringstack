import { and, count, desc, eq, isNull, lt, or, type SQL } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { auditLog } from "../../clients/postgres/schema";
import { ApiErrors } from "../../lib/errors";
import type { IActivityPage, IDashboardSummary } from "./dashboard.types";
import { formatActivityTitle } from "./dashboard.utils";

export class DashboardService {
  /*
   * Tenant scope for the feed: the user's own events in the current
   * account, plus their user-level events (null targetAccountId — logins,
   * profile changes). Events targeting OTHER accounts the user belongs to
   * must never leak into this account's dashboard.
   */
  private scopedUserFilters(userId: string, accountId: string): SQL[] {
    const filters: SQL[] = [eq(auditLog.userId, userId)];

    const accountScope = or(
      eq(auditLog.targetAccountId, accountId),
      isNull(auditLog.targetAccountId)
    );

    if (accountScope !== undefined) {
      filters.push(accountScope);
    }

    return filters;
  }

  async getSummary(
    userId: string,
    accountId: string
  ): Promise<IDashboardSummary> {
    const scope = and(...this.scopedUserFilters(userId, accountId));

    const [eventCountRow] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(scope);

    const recent = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        resource: auditLog.resource,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(scope)
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
    accountId: string,
    limit: number,
    cursor?: string
  ): Promise<IActivityPage> {
    const filters: SQL[] = this.scopedUserFilters(userId, accountId);

    if (cursor !== undefined && cursor !== "") {
      const cursorId = cursor.replace(/^cursor:/, "");
      const cursorRow = await db.query.auditLog.findFirst({
        where: and(
          eq(auditLog.id, cursorId),
          ...this.scopedUserFilters(userId, accountId)
        ),
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
