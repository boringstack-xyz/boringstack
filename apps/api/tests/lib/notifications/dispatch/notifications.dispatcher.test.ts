import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { t } from "elysia";
import {
  cleanDatabase,
  db,
  eq,
  notification,
  requireDb,
  users,
} from "../../../helpers/db";
import {
  channelRegistry,
  defineNotificationEvent,
  eventRegistry,
  inAppChannel,
  notifications,
} from "../../../../src/lib/notifications";

const insertTestUser = async (suffix: string): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: `dispatcher-${suffix}@example.com`,
      firstName: "X",
      lastName: "Y",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const event = defineNotificationEvent({
  type: "test.dispatcher.basic",
  schema: t.Object({ actorId: t.String() }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: `from ${payload.actorId}`,
      body: "hello",
    }),
  },
});

describe("NotificationDispatcher.send", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    channelRegistry.clear();
    channelRegistry.register(inAppChannel);
    eventRegistry.clear();
    eventRegistry.register(event);
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    channelRegistry.clear();
    eventRegistry.clear();
  });

  test("inline-dispatches (QUEUES_ENABLED=false default) and persists a row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("inline");

    await notifications.send(event, {
      recipientUserId: userId,
      payload: { actorId: "u-42" },
    });

    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventType).toBe(event.type);
  });

  test("channelsOverride forwards through to the inline dispatch", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("override");

    await notifications.send(event, {
      recipientUserId: userId,
      payload: { actorId: "u-1" },
      channelsOverride: ["in-app"],
    });

    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(rows).toHaveLength(1);
  });

  /*
   * Bad-payload rejection is covered by dispatch-job.test.ts, which takes
   * `payload: unknown` and can be called with a non-matching shape.
   * The dispatcher's generic `send<TPayload>` is typed-only so the bad call
   * can't be expressed at the API surface from TypeScript.
   */
});
