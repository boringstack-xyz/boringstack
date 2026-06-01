import { beforeEach, describe, expect, test } from "bun:test";

import { seedVerifiedUser } from "../../helpers/auth";
import { createApp } from "../../../src/config/app";
import {
  cleanDatabase,
  db,
  notification,
  notificationPreference,
  requireDb,
} from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const TEST_EVENT_TYPE = "demo.event";
const NOTIFY_HOST = "http://localhost/api/v1/notifications";
const MARK_ALL_READ_URL = `${NOTIFY_HOST}/mark-all-read`;

const isListBody = (value: unknown): value is { items: { title?: string }[] } =>
  value !== null &&
  typeof value === "object" &&
  "items" in value &&
  Array.isArray(value.items);

const isStatusBody = (value: unknown): value is { status: string } =>
  value !== null &&
  typeof value === "object" &&
  "status" in value &&
  typeof value.status === "string";

const isMarkAllBody = (value: unknown): value is { updated: number } =>
  value !== null &&
  typeof value === "object" &&
  "updated" in value &&
  typeof value.updated === "number";

const isPrefsBody = (value: unknown): value is { items: unknown[] } =>
  isListBody(value);

const extractCookiePair = (setCookie: string | null, name: string): string => {
  if (setCookie === null) {
    return "";
  }

  const match = new RegExp(`${name}=[^;,\\s]+`).exec(setCookie);

  return match?.[0] ?? "";
};

async function registerAndLogin(
  email: string
): Promise<{ userId: string; authCookie: string }> {
  const { user } = await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Notify",
    lastName: "Tester",
  });

  const app = createApp();
  const loginRes = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  return {
    userId: user.id,
    authCookie: extractCookiePair(
      loginRes.headers.get("set-cookie"),
      "auth_token"
    ),
  };
}

async function seedNotification(
  userId: string,
  overrides: Partial<{
    title: string;
    body: string;
    status: "unread" | "read" | "archived";
    eventType: string;
  }> = {}
): Promise<string> {
  const [row] = await db
    .insert(notification)
    .values({
      recipientUserId: userId,
      eventType: overrides.eventType ?? TEST_EVENT_TYPE,
      status: overrides.status ?? "unread",
      rendered: {
        title: overrides.title ?? "Test notification",
        body: overrides.body ?? "Body",
      },
    })
    .returning({ id: notification.id });

  if (!row) {
    throw new Error("seed notification failed");
  }

  return row.id;
}

describe("GET /api/v1/notifications/", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns 401 without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/")
    );

    expect(res.status).toBe(401);
  });

  test("returns 200 with the authenticated user's notifications only", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await registerAndLogin("notif-me@example.com");
    const other = await registerAndLogin("notif-other@example.com");

    await seedNotification(me.userId, { title: "mine" });
    await seedNotification(other.userId, { title: "theirs" });

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/", {
        headers: { cookie: me.authCookie },
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isListBody(body)) {
      throw new Error("expected a notifications list envelope");
    }

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.title).toBe("mine");
  });
});

describe("PATCH /api/v1/notifications/:id", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("flips status to read for the owning user, returns the updated row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await registerAndLogin("patch-me@example.com");
    const id = await seedNotification(me.userId, { status: "unread" });

    const app = createApp();
    const res = await app.handle(
      new Request(`http://localhost/api/v1/notifications/${id}`, {
        method: "PATCH",
        headers: {
          cookie: me.authCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "read" }),
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isStatusBody(body)) {
      throw new Error("expected a status-bearing envelope");
    }

    expect(body.status).toBe("read");
  });

  test("returns 4xx when the notification belongs to a different user (cross-user isolation)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await registerAndLogin("patch-me2@example.com");
    const other = await registerAndLogin("patch-other@example.com");
    const id = await seedNotification(other.userId);

    const app = createApp();
    const res = await app.handle(
      new Request(`http://localhost/api/v1/notifications/${id}`, {
        method: "PATCH",
        headers: {
          cookie: me.authCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "read" }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("POST /api/v1/notifications/mark-all-read", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("flips every unread notification owned by the user to read", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await registerAndLogin("mark-all-me@example.com");

    await seedNotification(me.userId, { status: "unread" });
    await seedNotification(me.userId, { status: "unread" });
    await seedNotification(me.userId, { status: "read" });

    const app = createApp();
    const res = await app.handle(
      new Request(MARK_ALL_READ_URL, {
        method: "POST",
        headers: { cookie: me.authCookie },
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isMarkAllBody(body)) {
      throw new Error("expected a mark-all-read envelope");
    }

    expect(body.updated).toBe(2);
  });

  test("idempotent: second call returns updated: 0", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await registerAndLogin("idempotent-me@example.com");

    await seedNotification(me.userId, { status: "unread" });

    const app = createApp();

    await app.handle(
      new Request(MARK_ALL_READ_URL, {
        method: "POST",
        headers: { cookie: me.authCookie },
      })
    );

    const res = await app.handle(
      new Request(MARK_ALL_READ_URL, {
        method: "POST",
        headers: { cookie: me.authCookie },
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isMarkAllBody(body)) {
      throw new Error("expected a mark-all-read envelope");
    }

    expect(body.updated).toBe(0);
  });
});

describe("GET /api/v1/notifications/preferences", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns the user's preferences after the cascade resolves", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await registerAndLogin("prefs-me@example.com");

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/preferences", {
        headers: { cookie: me.authCookie },
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isPrefsBody(body)) {
      throw new Error("expected a preferences envelope");
    }

    expect(Array.isArray(body.items)).toBe(true);
  });

  test("PUT writes user-scoped overrides into notification_preference", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await registerAndLogin("prefs-put@example.com");

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/notifications/preferences", {
        method: "PUT",
        headers: {
          cookie: me.authCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          preferences: [
            {
              eventType: TEST_EVENT_TYPE,
              channel: "email",
              enabled: false,
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);

    const rows = await db.select().from(notificationPreference);

    expect(rows.some((row) => row.userId === me.userId)).toBe(true);
  });
});
