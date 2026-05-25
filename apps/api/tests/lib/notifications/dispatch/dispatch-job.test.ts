import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { t } from "elysia";
import {
  cleanDatabase,
  db,
  eq,
  notification,
  notificationDedup,
  notificationDelivery,
  notificationPreference,
  requireDb,
  users,
} from "../../../helpers/db";
import {
  channelRegistry,
  defineNotificationEvent,
  eventRegistry,
  inAppChannel,
  runNotificationDispatch,
} from "../../../../src/lib/notifications";

const insertTestUser = async (suffix: string): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: `dispatch-job-${suffix}@example.com`,
      firstName: "D",
      lastName: "J",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const baseEvent = defineNotificationEvent({
  type: "test.dispatch.basic",
  schema: t.Object({ actorId: t.String() }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: `actor ${payload.actorId}`,
      body: "msg",
    }),
  },
});

const dedupEvent = defineNotificationEvent({
  type: "test.dispatch.dedup",
  schema: t.Object({ actorId: t.String() }),
  defaultChannels: ["in-app"],
  dedup: {
    key: ({ recipientUserId, payload }) =>
      `test.dispatch.dedup:${recipientUserId}:${payload.actorId}`,
    windowSeconds: 60,
  },
  render: {
    inApp: ({ payload }) => ({
      title: `actor ${payload.actorId}`,
      body: "",
    }),
  },
});

const selfGuardEvent = defineNotificationEvent({
  type: "test.dispatch.self_guard",
  schema: t.Object({ actorId: t.String() }),
  defaultChannels: ["in-app"],
  selfActionGuard: ({ recipientUserId, payload }) =>
    recipientUserId === payload.actorId,
  render: {
    inApp: () => ({ title: "guarded", body: "" }),
  },
});

const setupRegistries = (): void => {
  channelRegistry.clear();
  channelRegistry.register(inAppChannel);
  eventRegistry.clear();
  eventRegistry.registerAll([baseEvent, dedupEvent, selfGuardEvent]);
};

const wipeDedup = async (): Promise<void> => {
  await db.delete(notificationDedup);
};

describe("runNotificationDispatch", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    await wipeDedup();
    setupRegistries();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await wipeDedup();
    await cleanDatabase();
    channelRegistry.clear();
    eventRegistry.clear();
  });

  test("happy path: persists a notification row + sent in-app delivery", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("happy");

    const result = await runNotificationDispatch({
      eventType: baseEvent.type,
      recipientUserId: userId,
      payload: { actorId: "user-9" },
    });

    expect(result.outcome).toBe("dispatched");
    expect(result.notificationId).toBeDefined();

    const [row] = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(row?.eventType).toBe(baseEvent.type);
    expect(row?.status).toBe("unread");

    const [delivery] = await db
      .select()
      .from(notificationDelivery)
      .where(eq(notificationDelivery.notificationId, row?.id ?? ""));

    expect(delivery?.channel).toBe("in-app");
    expect(delivery?.status).toBe("sent");
  });

  test("returns unknown_event when no event is registered for the type", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("unknown");

    const result = await runNotificationDispatch({
      eventType: "not.registered",
      recipientUserId: userId,
      payload: {},
    });

    expect(result.outcome).toBe("unknown_event");
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(rows).toHaveLength(0);
  });

  test("throws when payload does not pass the event's schema", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("bad-payload");

    let thrown: unknown = null;

    try {
      await runNotificationDispatch({
        eventType: baseEvent.type,
        recipientUserId: userId,
        payload: { actorId: 42 },
      });
    } catch (err: unknown) {
      thrown = err;
    }

    expect(thrown).not.toBeNull();

    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(rows).toHaveLength(0);
  });

  test("self-action guard returning true short-circuits dispatch", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("self-guard");

    const result = await runNotificationDispatch({
      eventType: selfGuardEvent.type,
      recipientUserId: userId,
      payload: { actorId: userId },
    });

    expect(result.outcome).toBe("self_action_skipped");
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(rows).toHaveLength(0);
  });

  test("second event within the dedup window is deduplicated", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("dedup");

    const first = await runNotificationDispatch({
      eventType: dedupEvent.type,
      recipientUserId: userId,
      payload: { actorId: "user-7" },
    });
    const second = await runNotificationDispatch({
      eventType: dedupEvent.type,
      recipientUserId: userId,
      payload: { actorId: "user-7" },
    });

    expect(first.outcome).toBe("dispatched");
    expect(second.outcome).toBe("deduplicated");
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, userId));

    expect(rows).toHaveLength(1);
  });

  test("channelsOverride bypasses event.defaultChannels", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("override");

    const result = await runNotificationDispatch({
      eventType: baseEvent.type,
      recipientUserId: userId,
      payload: { actorId: "user-1" },
      channelsOverride: ["in-app"],
    });

    expect(result.outcome).toBe("dispatched");

    const deliveries = await db
      .select()
      .from(notificationDelivery)
      .where(
        eq(notificationDelivery.notificationId, result.notificationId ?? "")
      );
    const channels = deliveries.map((data) => data.channel);

    expect(channels).toEqual(["in-app"]);
  });

  test("unregistered channel still persists the notification but records a failed delivery", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("missing-channel");

    channelRegistry.clear();

    const result = await runNotificationDispatch({
      eventType: baseEvent.type,
      recipientUserId: userId,
      payload: { actorId: "user-2" },
    });

    expect(result.outcome).toBe("dispatched");

    const [delivery] = await db
      .select()
      .from(notificationDelivery)
      .where(
        eq(notificationDelivery.notificationId, result.notificationId ?? "")
      );

    expect(delivery?.status).toBe("failed");
    expect(delivery?.error).toBe("channel_not_registered");
  });
});

describe("runNotificationDispatch — preferences cascade", () => {
  const multiChannelEvent = defineNotificationEvent({
    type: "test.dispatch.multi_channel",
    schema: t.Object({ actorId: t.String() }),
    defaultChannels: ["in-app", "email"],
    render: {
      inApp: () => ({ title: "multi", body: "" }),
      email: {
        subject: () => "subj",
        templatePath: "notifications/generic-notification",
      },
    },
  });

  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    await db.delete(notificationDedup);
    channelRegistry.clear();
    channelRegistry.register(inAppChannel);
    eventRegistry.clear();
    eventRegistry.register(multiChannelEvent);
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await db.delete(notificationDedup);
    await cleanDatabase();
    channelRegistry.clear();
    eventRegistry.clear();
  });

  test("preference-disabled channel becomes a `suppressed` delivery row, in-app still sent", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("pref-disabled");

    await db.insert(notificationPreference).values({
      userId,
      eventType: multiChannelEvent.type,
      channel: "email",
      enabled: false,
    });

    const result = await runNotificationDispatch({
      eventType: multiChannelEvent.type,
      recipientUserId: userId,
      payload: { actorId: "user-1" },
    });

    expect(result.outcome).toBe("dispatched");

    const deliveries = await db
      .select()
      .from(notificationDelivery)
      .where(
        eq(notificationDelivery.notificationId, result.notificationId ?? "")
      );

    const byChannel = Object.fromEntries(
      deliveries.map((row) => [row.channel, row])
    );

    expect(byChannel["in-app"]?.status).toBe("sent");
    expect(byChannel.email?.status).toBe("suppressed");
    expect(byChannel.email?.error).toBe("preference_disabled");
  });
});
