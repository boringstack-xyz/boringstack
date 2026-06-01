import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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
  emailChannel,
  eventRegistry,
  inAppChannel,
  runNotificationDispatch,
} from "../../../../src/lib/notifications";

const insertTestUser = async (
  suffix: string
): Promise<{ id: string; email: string }> => {
  const email = `email-channel-${suffix}@example.com`;
  const [created] = await db
    .insert(users)
    .values({ email, firstName: "E", lastName: "M" })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return { id: created.id, email };
};

const eventWithEmail = defineNotificationEvent({
  type: "test.email.channel.with",
  schema: t.Object({ actorName: t.String() }),
  defaultChannels: ["in-app", "email"],
  render: {
    inApp: ({ payload }) => ({
      title: `${payload.actorName} pinged you`,
      body: "",
    }),
    email: {
      subject: ({ payload }) => `Ping from ${payload.actorName}`,
      templatePath: "notifications/generic-notification",
      variables: ({ payload }) => ({
        title: `Ping from ${payload.actorName}`,
        bodyHtml: `<p>${payload.actorName} pinged you.</p>`,
        ctaUrl: "https://example.com/inbox",
        ctaLabel: "Open inbox",
      }),
    },
  },
});

const eventWithoutEmail = defineNotificationEvent({
  type: "test.email.channel.without",
  schema: t.Object({ actorName: t.String() }),
  defaultChannels: ["in-app", "email"],
  render: {
    inApp: ({ payload }) => ({ title: payload.actorName, body: "" }),
  },
});

describe("emailChannel.dispatch", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    channelRegistry.clear();
    channelRegistry.register(inAppChannel);
    channelRegistry.register(emailChannel);
    eventRegistry.clear();
    eventRegistry.registerAll([eventWithEmail, eventWithoutEmail]);
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    channelRegistry.clear();
    eventRegistry.clear();
  });

  test("sends inline (queues disabled) and settles the email delivery row to sent", async () => {
    if (!(await requireDb())) {
      return;
    }

    const user = await insertTestUser("inline-sent");

    const result = await runNotificationDispatch({
      eventType: eventWithEmail.type,
      recipientUserId: user.id,
      payload: { actorName: "alice" },
    });

    expect(result.outcome).toBe("dispatched");

    const [emailDelivery] = await db
      .select()
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.notificationId, result.notificationId ?? ""),
          eq(notificationDelivery.channel, "email")
        )
      );

    expect(emailDelivery?.status).toBe("sent");
    expect(emailDelivery?.sentAt).not.toBeNull();
  });

  test("marks the email delivery row suppressed when the event has no email render", async () => {
    if (!(await requireDb())) {
      return;
    }

    const user = await insertTestUser("no-render");

    const result = await runNotificationDispatch({
      eventType: eventWithoutEmail.type,
      recipientUserId: user.id,
      payload: { actorName: "bob" },
    });

    expect(result.outcome).toBe("dispatched");

    const [emailDelivery] = await db
      .select()
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.notificationId, result.notificationId ?? ""),
          eq(notificationDelivery.channel, "email")
        )
      );

    expect(emailDelivery?.status).toBe("suppressed");
    expect(emailDelivery?.error).toBe("no_email_render");
  });

  test("does not touch the in-app delivery row's status (channel-scoped writes)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const user = await insertTestUser("scope");

    const result = await runNotificationDispatch({
      eventType: eventWithEmail.type,
      recipientUserId: user.id,
      payload: { actorName: "carol" },
    });

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

    expect(notif?.recipientUserId).toBe(user.id);
  });
});
