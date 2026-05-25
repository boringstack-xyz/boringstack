import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanDatabase,
  db,
  eq,
  notification,
  requireDb,
  users,
} from "../../helpers/db";
import { notificationsService } from "../../../src/api/notifications/notifications.service";

const insertTestUser = async (suffix: string): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: `notif-service-${suffix}@example.com`,
      firstName: "N",
      lastName: "S",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const insertNotification = async (input: {
  recipientUserId: string;
  status: "unread" | "read" | "archived";
  rendered: { title: string; body: string };
  eventType?: string;
}): Promise<string> => {
  const [row] = await db
    .insert(notification)
    .values({
      recipientUserId: input.recipientUserId,
      eventType: input.eventType ?? "test.service.event",
      payload: { value: "x" },
      rendered: input.rendered,
      status: input.status,
    })
    .returning({ id: notification.id });

  if (!row) {
    throw new Error("Failed to insert notification");
  }

  return row.id;
};

describe("NotificationsService.list", () => {
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

  test("returns only the requesting user's rows", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("me");
    const other = await insertTestUser("other");

    await insertNotification({
      recipientUserId: me,
      status: "unread",
      rendered: { title: "mine", body: "" },
    });
    await insertNotification({
      recipientUserId: other,
      status: "unread",
      rendered: { title: "theirs", body: "" },
    });

    const page = await notificationsService.list({ userId: me, limit: 10 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe("mine");
  });

  test("filters by status when supplied", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("filter");

    await insertNotification({
      recipientUserId: userId,
      status: "unread",
      rendered: { title: "u", body: "" },
    });
    await insertNotification({
      recipientUserId: userId,
      status: "read",
      rendered: { title: "r", body: "" },
    });

    const unread = await notificationsService.list({
      userId,
      status: "unread",
      limit: 10,
    });
    const read = await notificationsService.list({
      userId,
      status: "read",
      limit: 10,
    });

    expect(unread.items.map((item) => item.status)).toEqual(["unread"]);
    expect(read.items.map((item) => item.status)).toEqual(["read"]);
  });

  test("returns nextCursor when more rows exist beyond the limit", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("paginate");

    for (let i = 0; i < 5; i++) {
      await insertNotification({
        recipientUserId: userId,
        status: "unread",
        rendered: { title: `n${i.toString()}`, body: "" },
      });
    }

    const page = await notificationsService.list({ userId, limit: 3 });

    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).not.toBeNull();
  });

  test("maps rendered.title / body / ctaUrl / ctaLabel onto the public shape", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("shape");

    await insertNotification({
      recipientUserId: userId,
      status: "unread",
      rendered: {
        title: "hello",
        body: "world",
      },
    });
    await db.update(notification).set({
      rendered: {
        title: "hello",
        body: "world",
        ctaUrl: "/foo",
        ctaLabel: "Open",
      },
    });

    const page = await notificationsService.list({ userId, limit: 10 });

    expect(page.items[0]).toMatchObject({
      title: "hello",
      body: "world",
      ctaUrl: "/foo",
      ctaLabel: "Open",
    });
  });
});

describe("NotificationsService.updateStatus", () => {
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

  test("marks read and sets readAt", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("update");
    const notificationId = await insertNotification({
      recipientUserId: userId,
      status: "unread",
      rendered: { title: "t", body: "b" },
    });

    const updated = await notificationsService.updateStatus({
      userId,
      notificationId,
      status: "read",
    });

    expect(updated.status).toBe("read");
    expect(updated.readAt).not.toBeNull();
  });

  test("marks archived and leaves readAt null", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("archive");
    const notificationId = await insertNotification({
      recipientUserId: userId,
      status: "unread",
      rendered: { title: "t", body: "b" },
    });

    const updated = await notificationsService.updateStatus({
      userId,
      notificationId,
      status: "archived",
    });

    expect(updated.status).toBe("archived");
    expect(updated.readAt).toBeNull();
  });

  test("rejects with 404-shaped error when the row belongs to a different user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const owner = await insertTestUser("owner");
    const attacker = await insertTestUser("attacker");
    const notificationId = await insertNotification({
      recipientUserId: owner,
      status: "unread",
      rendered: { title: "t", body: "b" },
    });

    let thrown: unknown = null;

    try {
      await notificationsService.updateStatus({
        userId: attacker,
        notificationId,
        status: "read",
      });
    } catch (err: unknown) {
      thrown = err;
    }

    expect(thrown).not.toBeNull();

    const [row] = await db
      .select()
      .from(notification)
      .where(eq(notification.id, notificationId));

    expect(row?.status).toBe("unread");
  });
});

describe("NotificationsService.markAllRead", () => {
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

  test("flips every unread row to read and reports the count", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("bulk");

    await insertNotification({
      recipientUserId: userId,
      status: "unread",
      rendered: { title: "a", body: "" },
    });
    await insertNotification({
      recipientUserId: userId,
      status: "unread",
      rendered: { title: "b", body: "" },
    });
    await insertNotification({
      recipientUserId: userId,
      status: "read",
      rendered: { title: "c", body: "" },
    });

    const result = await notificationsService.markAllRead({ userId });

    expect(result.updated).toBe(2);

    const reads = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(reads.every((row) => row.status === "read")).toBe(true);
  });
});
