import { and, asc, eq } from "drizzle-orm";

import { db } from "../../clients/postgres";
import { widgets } from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";
import { now } from "../../lib/time/now";

import type {
  ICreateWidgetInput,
  IUpdateWidgetInput,
  IWidget,
} from "./widgets.types";

export class WidgetsService {
  async list(accountId: string): Promise<IWidget[]> {
    return db
      .select()
      .from(widgets)
      .where(eq(widgets.accountId, accountId))
      .orderBy(asc(widgets.createdAt));
  }

  async getById(accountId: string, id: string): Promise<IWidget> {
    const [row] = await db
      .select()
      .from(widgets)
      .where(and(eq(widgets.id, id), eq(widgets.accountId, accountId)))
      .limit(1);

    if (!row) {
      throw ApiErrors.notFound("Widget");
    }

    return row;
  }

  async create(
    accountId: string,
    actorUserId: string,
    input: ICreateWidgetInput
  ): Promise<IWidget> {
    const [created] = await db
      .insert(widgets)
      .values({ accountId, name: input.name })
      .returning();

    if (!created) {
      throw ApiErrors.database("Failed to create widget");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.WIDGET_CREATED,
      resource: `widget:${created.id}`,
      metadata: { name: created.name, accountId },
    });

    return created;
  }

  async update(
    accountId: string,
    actorUserId: string,
    id: string,
    input: IUpdateWidgetInput
  ): Promise<IWidget> {
    const [updated] = await db
      .update(widgets)
      .set({ name: input.name, updatedAt: now() })
      .where(and(eq(widgets.id, id), eq(widgets.accountId, accountId)))
      .returning();

    if (!updated) {
      throw ApiErrors.notFound("Widget");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.WIDGET_UPDATED,
      resource: `widget:${updated.id}`,
      metadata: { name: updated.name, accountId },
    });

    return updated;
  }

  async delete(
    accountId: string,
    actorUserId: string,
    id: string
  ): Promise<void> {
    const deleted = await db
      .delete(widgets)
      .where(and(eq(widgets.id, id), eq(widgets.accountId, accountId)))
      .returning({ id: widgets.id });

    if (deleted.length === 0) {
      throw ApiErrors.notFound("Widget");
    }

    void auditLogService.record({
      userId: actorUserId,
      action: AUDIT_ACTIONS.WIDGET_DELETED,
      resource: `widget:${id}`,
      metadata: { accountId },
    });
  }
}

export const widgetsService = new WidgetsService();
