import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  auditLog,
  cleanDatabase,
  db,
  requireDb,
  users,
} from "../../helpers/db";
import { dashboardService } from "../../../src/api/dashboard/dashboard.service";

const LOGIN = "user.login";
const LOGOUT = "user.logout";

const insertTestUser = async (suffix: string): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: `dashboard-${suffix}@example.com`,
      firstName: "D",
      lastName: suffix,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const insertAudit = async (input: {
  userId: string | null;
  action: string;
  resource?: string;
}): Promise<string> => {
  const [row] = await db
    .insert(auditLog)
    .values({
      userId: input.userId,
      action: input.action,
      resource: input.resource ?? null,
    })
    .returning({ id: auditLog.id });

  if (!row) {
    throw new Error("Failed to insert audit row");
  }

  return row.id;
};

describe("DashboardService.getSummary user isolation", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("totalEvents counts only the requesting user's rows", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("me-summary");
    const other = await insertTestUser("other-summary");

    await insertAudit({ userId: me, action: LOGIN });
    await insertAudit({ userId: me, action: LOGOUT });
    await insertAudit({ userId: other, action: LOGIN });
    await insertAudit({ userId: other, action: LOGIN });
    await insertAudit({ userId: other, action: LOGOUT });
    await insertAudit({ userId: null, action: "system.cron" });

    const mine = await dashboardService.getSummary(me);
    const theirs = await dashboardService.getSummary(other);

    expect(mine.totalEvents).toBe(2);
    expect(theirs.totalEvents).toBe(3);
  });

  test("recentActivity excludes other users' rows", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("me-activity");
    const other = await insertTestUser("other-activity");

    const myRowId = await insertAudit({ userId: me, action: LOGIN });

    await insertAudit({ userId: other, action: LOGIN });
    await insertAudit({ userId: other, action: LOGOUT });

    const summary = await dashboardService.getSummary(me);

    expect(summary.recentActivity).toHaveLength(1);
    expect(summary.recentActivity[0]?.id).toBe(myRowId);
  });
});

describe("DashboardService.getActivity user isolation", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("paginated list excludes other users' rows", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("me-list");
    const other = await insertTestUser("other-list");

    const mineIds: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      mineIds.push(
        await insertAudit({ userId: me, action: `user.event.${index}` })
      );
    }

    await insertAudit({ userId: other, action: "user.event.x" });
    await insertAudit({ userId: other, action: "user.event.y" });

    const page = await dashboardService.getActivity(me, 10);

    expect(page.items).toHaveLength(3);
    expect(page.items.every((item) => mineIds.includes(item.id))).toBe(true);
  });

  test("rejects a cursor pointing at another user's row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("me-cursor");
    const other = await insertTestUser("other-cursor");

    const otherId = await insertAudit({
      userId: other,
      action: LOGIN,
    });

    await insertAudit({ userId: me, action: LOGIN });

    let caught: unknown;

    try {
      await dashboardService.getActivity(me, 10, `cursor:${otherId}`);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);

    if (caught instanceof Error) {
      expect(caught.message).toMatch(/cursor/i);
    }
  });

  test("returns empty items and null nextCursor when no rows exist", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("empty-list");

    const page = await dashboardService.getActivity(me, 10);

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  test("respects the limit parameter", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("limit-list");

    for (let index = 0; index < 5; index += 1) {
      await insertAudit({ userId: me, action: `user.event.${index}` });
    }

    const page = await dashboardService.getActivity(me, 2);

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
  });

  test("recentActivity is ordered newest-first", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("ordering");

    const first = await insertAudit({ userId: me, action: "first" });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await insertAudit({ userId: me, action: "second" });

    const summary = await dashboardService.getSummary(me);

    expect(summary.recentActivity[0]?.id).toBe(second);
    expect(summary.recentActivity[1]?.id).toBe(first);
  });
});

describe("DashboardService.getSummary edge cases", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns zero totalEvents and empty recentActivity for a new user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("fresh");

    const summary = await dashboardService.getSummary(me);

    expect(summary.totalEvents).toBe(0);
    expect(summary.recentActivity).toEqual([]);
  });
});
