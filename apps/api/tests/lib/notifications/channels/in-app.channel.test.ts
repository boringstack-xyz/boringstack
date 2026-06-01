import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanDatabase,
  db,
  eq,
  notification,
  notificationDelivery,
  requireDb,
  users,
} from "../../../helpers/db";
import {
  defineNotificationEvent,
  inAppChannel,
} from "../../../../src/lib/notifications";
import { t } from "elysia";

const insertTestUser = async (): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: "in-app-channel-test@example.com",
      firstName: "I",
      lastName: "A",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const testEvent = defineNotificationEvent({
  type: "test.in_app.channel",
  schema: t.Object({ message: t.String() }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: "in-app test",
      body: payload.message,
    }),
  },
});

describe("inAppChannel.dispatch", () => {
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

  test("transitions the in-app delivery row to sent with a sentAt timestamp", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();
    const [noti] = await db
      .insert(notification)
      .values({
        recipientUserId: userId,
        eventType: testEvent.type,
        payload: { message: "hi" },
        rendered: { title: "t", body: "b" },
      })
      .returning();

    if (!noti) {
      throw new Error("Failed to insert notification");
    }

    await db.insert(notificationDelivery).values({
      notificationId: noti.id,
      channel: "in-app",
      status: "pending",
    });

    await inAppChannel.dispatch({
      notificationId: noti.id,
      recipientUserId: userId,
      event: testEvent,
      payload: { message: "hi" },
      rendered: { title: "t", body: "b" },
    });

    const [row] = await db
      .select()
      .from(notificationDelivery)
      .where(eq(notificationDelivery.notificationId, noti.id));

    expect(row?.status).toBe("sent");
    expect(row?.sentAt).not.toBeNull();
  });

  test("is a no-op when the in-app delivery row is missing (UPDATE affects zero rows)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();
    const missingNotificationId = "00000000-0000-0000-0000-000000000000";

    await inAppChannel.dispatch({
      notificationId: missingNotificationId,
      recipientUserId: userId,
      event: testEvent,
      payload: { message: "hi" },
      rendered: { title: "t", body: "b" },
    });

    const rows = await db
      .select()
      .from(notificationDelivery)
      .where(eq(notificationDelivery.notificationId, missingNotificationId));

    expect(rows).toHaveLength(0);
  });
});
