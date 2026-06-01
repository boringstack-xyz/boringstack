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
  webPushChannel,
} from "../../../../src/lib/notifications";
import { t } from "elysia";

const insertTestUser = async (): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: "web-push-channel-test@example.com",
      firstName: "W",
      lastName: "P",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const testEvent = defineNotificationEvent({
  type: "test.web_push.channel",
  schema: t.Object({ message: t.String() }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: "web-push test",
      body: payload.message,
    }),
  },
});

describe("webPushChannel.dispatch", () => {
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

  test("suppresses the delivery when the recipient has no push subscriptions", async () => {
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
      channel: "web-push",
      status: "pending",
    });

    await webPushChannel.dispatch({
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

    expect(row?.status).toBe("suppressed");
    expect(row?.error).toBe("no_subscriptions");
  });

  test("is a no-op when the web-push delivery row is missing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser();
    const missingNotificationId = "00000000-0000-0000-0000-000000000000";

    await webPushChannel.dispatch({
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
