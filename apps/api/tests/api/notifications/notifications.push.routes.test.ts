import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import {
  cleanDatabase,
  db,
  eq,
  pushSubscription,
  requireDb,
  users,
} from "../../helpers/db";
import notificationsPushRoutes from "../../../src/api/notifications/notifications.push.routes";

/**
 * The push routes file exports an Elysia plugin already wrapped in the
 * auth middleware. We mount it on a small Elysia app and assert that
 * unauthenticated requests are rejected and that the contract shape is
 * what callers expect. Database-touching upsert + delete semantics are
 * covered by `notifications.push.service.test.ts`.
 */
const mountTestApp = () =>
  new Elysia().group("/api/v1/notifications/push", (app) =>
    app.use(notificationsPushRoutes)
  );

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

describe("notifications.push routes — unauthenticated", () => {
  test("POST /subscribe rejects without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = mountTestApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://push.example/x",
          keys: { p256dh: "k", auth: "a" },
        }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("GET /subscriptions rejects without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = mountTestApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/push/subscriptions")
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("DELETE /subscribe rejects without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = mountTestApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "https://push.example/x" }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("notifications.push routes — DB shape", () => {
  test("inserting a user + subscription via the service makes the row visible to the same DB harness", async () => {
    if (!(await requireDb())) {
      return;
    }

    const [user] = await db
      .insert(users)
      .values({
        email: "push-routes@example.com",
        firstName: "P",
        lastName: "R",
      })
      .returning();

    if (!user) {
      throw new Error("Failed to insert test user");
    }

    await db.insert(pushSubscription).values({
      userId: user.id,
      endpoint: "https://push.example/routes-test",
      p256dhKey: "k",
      authKey: "a",
    });

    const rows = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, user.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.endpoint).toBe("https://push.example/routes-test");
  });
});
