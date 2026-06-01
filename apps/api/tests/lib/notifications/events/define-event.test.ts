import { describe, expect, test } from "bun:test";
import { t } from "elysia";
import { defineNotificationEvent } from "../../../../src/lib/notifications";

const schema = t.Object({
  actorId: t.String(),
  excerpt: t.String(),
});

describe("defineNotificationEvent", () => {
  test("preserves the type, schema, and defaultChannels verbatim", () => {
    const event = defineNotificationEvent({
      type: "define.test.preserve",
      schema,
      defaultChannels: ["in-app", "email"],
      render: {
        inApp: ({ payload }) => ({
          title: `posted by ${payload.actorId}`,
          body: payload.excerpt,
        }),
      },
    });

    expect(event.type).toBe("define.test.preserve");
    expect(event.schema).toBe(schema);
    expect(event.defaultChannels).toEqual(["in-app", "email"]);
  });

  test("wraps render.inApp so it receives a typed payload at runtime", () => {
    const event = defineNotificationEvent({
      type: "define.test.render",
      schema,
      defaultChannels: ["in-app"],
      render: {
        inApp: ({ payload }) => ({
          title: payload.actorId,
          body: payload.excerpt,
        }),
      },
    });

    const rendered = event.render.inApp?.({
      recipientUserId: "user-1",
      payload: { actorId: "u-7", excerpt: "hello" },
    });

    expect(rendered).toEqual({ title: "u-7", body: "hello" });
  });

  test("self-action guard sees the typed payload", () => {
    const event = defineNotificationEvent({
      type: "define.test.guard",
      schema,
      defaultChannels: ["in-app"],
      selfActionGuard: ({ recipientUserId, payload }) =>
        recipientUserId === payload.actorId,
      render: {
        inApp: ({ payload }) => ({ title: payload.actorId, body: "" }),
      },
    });

    const skipped = event.selfActionGuard?.({
      recipientUserId: "u-1",
      payload: { actorId: "u-1", excerpt: "x" },
    });
    const fires = event.selfActionGuard?.({
      recipientUserId: "u-1",
      payload: { actorId: "u-2", excerpt: "x" },
    });

    expect(skipped).toBe(true);
    expect(fires).toBe(false);
  });

  test("dedup.key receives the typed payload and returns the computed string", () => {
    const event = defineNotificationEvent({
      type: "define.test.dedup",
      schema,
      defaultChannels: ["in-app"],
      dedup: {
        key: ({ recipientUserId, payload }) =>
          `dedup:${recipientUserId}:${payload.actorId}`,
        windowSeconds: 600,
      },
      render: {
        inApp: ({ payload }) => ({ title: payload.actorId, body: "" }),
      },
    });

    const key = event.dedup?.key({
      recipientUserId: "u-1",
      payload: { actorId: "u-7", excerpt: "" },
    });

    expect(key).toBe("dedup:u-1:u-7");
    expect(event.dedup?.windowSeconds).toBe(600);
  });

  test("email render exposes subject + templatePath + variables when provided", () => {
    const event = defineNotificationEvent({
      type: "define.test.email",
      schema,
      defaultChannels: ["email"],
      render: {
        email: {
          subject: ({ payload }) => `Reply from ${payload.actorId}`,
          templatePath: "notifications/test",
          variables: ({ payload }) => ({ actor: payload.actorId }),
        },
      },
    });

    expect(event.render.email?.templatePath).toBe("notifications/test");
    expect(
      event.render.email?.subject({
        recipientUserId: "u-1",
        payload: { actorId: "u-9", excerpt: "x" },
      })
    ).toBe("Reply from u-9");
    expect(
      event.render.email?.variables?.({
        recipientUserId: "u-1",
        payload: { actorId: "u-9", excerpt: "x" },
      })
    ).toEqual({ actor: "u-9" });
  });

  test("omitted optional handlers stay undefined on the erased event", () => {
    const event = defineNotificationEvent({
      type: "define.test.minimal",
      schema,
      defaultChannels: ["in-app"],
      render: {
        inApp: ({ payload }) => ({ title: payload.actorId, body: "" }),
      },
    });

    expect(event.selfActionGuard).toBeUndefined();
    expect(event.dedup).toBeUndefined();
    expect(event.render.email).toBeUndefined();
  });
});
