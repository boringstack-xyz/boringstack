import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { t } from "elysia";
import {
  and,
  cleanDatabase,
  db,
  eq,
  notification,
  notificationDelivery,
  requireDb,
  users,
} from "../../../helpers/db";
import {
  channelRegistry,
  defineNotificationEvent,
  eventRegistry,
  inAppChannel,
  runNotificationDispatch,
  sseChannel,
  userNotificationChannel,
  valkeyPubSub,
} from "../../../../src/lib/notifications";
import { requireValkey } from "../../../helpers/valkey";

const waitFor = (
  predicate: () => boolean,
  timeoutMs: number
): Promise<boolean> => {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve(true);

        return;
      }

      if (Date.now() - start < timeoutMs) {
        return;
      }

      clearInterval(interval);
      resolve(false);
    }, 20);
  });
};

const isJsonObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const insertTestUser = async (suffix: string): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: `sse-channel-${suffix}@example.com`,
      firstName: "S",
      lastName: "E",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const sseEvent = defineNotificationEvent({
  type: "test.sse.channel",
  schema: t.Object({ actorName: t.String() }),
  defaultChannels: ["in-app", "sse"],
  render: {
    inApp: ({ payload }) => ({
      title: `${payload.actorName} pinged`,
      body: "hi",
    }),
  },
});

describe("sseChannel.dispatch", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    channelRegistry.clear();
    channelRegistry.register(inAppChannel);
    channelRegistry.register(sseChannel);
    eventRegistry.clear();
    eventRegistry.register(sseEvent);
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    channelRegistry.clear();
    eventRegistry.clear();
    await valkeyPubSub.resetForTests();
  });

  afterAll(async () => {
    await valkeyPubSub.resetForTests();
  });

  test("publishes to the per-user Valkey channel and marks delivery sent", async () => {
    if (!(await requireDb())) {
      return;
    }

    if (!(await requireValkey())) {
      return;
    }

    const userId = await insertTestUser("publish");
    const received: string[] = [];
    const subscriber = await valkeyPubSub.subscribe(
      userNotificationChannel(userId),
      (msg) => {
        received.push(msg);
      }
    );

    try {
      const result = await runNotificationDispatch({
        eventType: sseEvent.type,
        recipientUserId: userId,
        payload: { actorName: "alice" },
      });

      expect(result.outcome).toBe("dispatched");

      const arrived = await waitFor(() => received.length >= 1, 500);

      expect(arrived).toBe(true);

      const rawMessage = received[0] ?? "{}";
      const parsed: unknown = JSON.parse(rawMessage);

      expect(isJsonObject(parsed)).toBe(true);

      if (!isJsonObject(parsed)) {
        throw new Error("Expected SSE message to be a JSON object");
      }

      expect(parsed.type).toBe("notification.created");
      expect(isJsonObject(parsed.notification)).toBe(true);

      if (!isJsonObject(parsed.notification)) {
        throw new Error("Expected SSE message notification to be an object");
      }

      expect(parsed.notification.id).toBe(result.notificationId ?? "");
      expect(parsed.notification.eventType).toBe(sseEvent.type);
      expect(parsed.notification.title).toBe("alice pinged");
      expect(parsed.notification.status).toBe("unread");

      const [delivery] = await db
        .select()
        .from(notificationDelivery)
        .where(
          and(
            eq(
              notificationDelivery.notificationId,
              result.notificationId ?? ""
            ),
            eq(notificationDelivery.channel, "sse")
          )
        );

      expect(delivery?.status).toBe("sent");
      expect(delivery?.sentAt).not.toBeNull();
    } finally {
      await subscriber.disconnect();
    }
  });

  test("does not affect the in-app delivery row (channel-scoped writes)", async () => {
    if (!(await requireDb())) {
      return;
    }

    if (!(await requireValkey())) {
      return;
    }

    const userId = await insertTestUser("scoped");

    const result = await runNotificationDispatch({
      eventType: sseEvent.type,
      recipientUserId: userId,
      payload: { actorName: "carol" },
    });

    expect(result.outcome).toBe("dispatched");

    const [inAppDelivery] = await db
      .select()
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.notificationId, result.notificationId ?? ""),
          eq(notificationDelivery.channel, "in-app")
        )
      );

    expect(inAppDelivery?.status).toBe("sent");

    const [notif] = await db
      .select()
      .from(notification)
      .where(eq(notification.id, result.notificationId ?? ""));

    expect(notif?.recipientUserId).toBe(userId);
  });
});
