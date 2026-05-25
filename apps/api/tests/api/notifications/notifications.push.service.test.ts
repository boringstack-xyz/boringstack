import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanDatabase,
  db,
  eq,
  pushSubscription,
  requireDb,
  users,
} from "../../helpers/db";
import { notificationsPushService } from "../../../src/api/notifications/notifications.push.service";

const insertTestUser = async (suffix: string): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: `push-svc-${suffix}@example.com`,
      firstName: "P",
      lastName: "S",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

const baseSubscribeInput = (userId: string) => ({
  userId,
  endpoint: "https://push.example/abc",
  p256dhKey: "p256dh-key",
  authKey: "auth-key",
  expiresAt: null,
  userAgent: "test-agent",
});

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

describe("NotificationsPushService.subscribe", () => {
  test("inserts a new push_subscription row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("insert");
    const result = await notificationsPushService.subscribe(
      baseSubscribeInput(userId)
    );

    expect(result.endpoint).toBe("https://push.example/abc");
    expect(result.userAgent).toBe("test-agent");

    const rows = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.p256dhKey).toBe("p256dh-key");
  });

  test("upserts on (userId, endpoint) — refreshes keys instead of duplicating", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("upsert");

    await notificationsPushService.subscribe(baseSubscribeInput(userId));
    await notificationsPushService.subscribe({
      ...baseSubscribeInput(userId),
      p256dhKey: "rotated-p256dh",
      authKey: "rotated-auth",
    });

    const rows = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.p256dhKey).toBe("rotated-p256dh");
    expect(rows[0]?.authKey).toBe("rotated-auth");
  });
});

describe("NotificationsPushService.unsubscribe", () => {
  test("removes the row matching (userId, endpoint) and returns the count", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("unsub");

    await notificationsPushService.subscribe(baseSubscribeInput(userId));

    const result = await notificationsPushService.unsubscribe({
      userId,
      endpoint: "https://push.example/abc",
    });

    expect(result.removed).toBe(1);

    const rows = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId));

    expect(rows).toHaveLength(0);
  });

  test("returns 0 when no matching subscription exists", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("nomatch");
    const result = await notificationsPushService.unsubscribe({
      userId,
      endpoint: "https://push.example/does-not-exist",
    });

    expect(result.removed).toBe(0);
  });
});

describe("NotificationsPushService.listForUser", () => {
  test("returns the user's subscriptions without secret fields", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("list");

    await notificationsPushService.subscribe(baseSubscribeInput(userId));

    const items = await notificationsPushService.listForUser(userId);

    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty("p256dhKey");
    expect(items[0]?.endpoint).toBe("https://push.example/abc");
  });
});
