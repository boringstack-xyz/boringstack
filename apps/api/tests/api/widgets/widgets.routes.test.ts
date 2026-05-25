import { beforeEach, describe, expect, test } from "bun:test";

import { seedVerifiedUser } from "../../helpers/auth";
import { createApp } from "../../../src/config/app";
import { clearMembershipCacheForTests } from "../../../src/middleware/require-active-membership";
import {
  accountMemberships,
  cleanDatabase,
  db,
  eq,
  requireDb,
  widgets,
} from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const WIDGETS_URL = "http://localhost/api/v1/widgets";
const ALICE_WIDGET_NAME = "alice-widget";

const extractCookie = (setCookie: string | null, name: string): string => {
  if (setCookie === null) {
    return "";
  }

  const match = new RegExp(`${name}=[^;,\\s]+`).exec(setCookie);

  return match?.[0] ?? "";
};

const isWidget = (
  value: unknown
): value is { id: string; accountId: string; name: string } =>
  value !== null &&
  typeof value === "object" &&
  "id" in value &&
  typeof value.id === "string" &&
  "accountId" in value &&
  typeof value.accountId === "string" &&
  "name" in value &&
  typeof value.name === "string";

const isWidgetList = (
  value: unknown
): value is { items: { id: string; name: string }[] } =>
  value !== null &&
  typeof value === "object" &&
  "items" in value &&
  Array.isArray(value.items);

async function registerAndLogin(
  email: string
): Promise<{ userId: string; cookie: string; accountId: string }> {
  const { user } = await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Isolation",
    lastName: "Test",
  });

  const app = createApp();
  const loginRes = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  const cookie = extractCookie(
    loginRes.headers.get("set-cookie"),
    "auth_token"
  );

  const meRes = await app.handle(
    new Request("http://localhost/api/v1/users/me", { headers: { cookie } })
  );
  const meBody: unknown = await meRes.json();

  if (
    meBody === null ||
    typeof meBody !== "object" ||
    !("account" in meBody) ||
    meBody.account === null ||
    typeof meBody.account !== "object" ||
    !("id" in meBody.account) ||
    typeof meBody.account.id !== "string"
  ) {
    throw new Error("/me did not return the account id");
  }

  return { userId: user.id, cookie, accountId: meBody.account.id };
}

const createWidget = async (
  cookie: string,
  name: string
): Promise<{ id: string; accountId: string }> => {
  const app = createApp();
  const res = await app.handle(
    new Request(WIDGETS_URL, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );

  if (res.status !== 200) {
    const body = await res.text();

    throw new Error(
      `create widget failed (status=${res.status.toString()}, body=${body})`
    );
  }

  const body: unknown = await res.json();

  if (!isWidget(body)) {
    throw new Error("create widget did not return a widget envelope");
  }

  return { id: body.id, accountId: body.accountId };
};

describe("Widgets — cross-account isolation matrix", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    clearMembershipCacheForTests();
  });

  test("auth is required (401 without a cookie)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(new Request(WIDGETS_URL));

    expect(res.status).toBe(401);
  });

  test("GET /widgets returns only widgets owned by the requesting account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("alice@example.com");
    const bobSession = await registerAndLogin("bob@example.com");

    await createWidget(aliceSession.cookie, ALICE_WIDGET_NAME);
    await createWidget(bobSession.cookie, "bob-widget");

    const app = createApp();
    const res = await app.handle(
      new Request(WIDGETS_URL, { headers: { cookie: aliceSession.cookie } })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isWidgetList(body)) {
      throw new Error("expected a widget list envelope");
    }

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toBe(ALICE_WIDGET_NAME);
  });

  test("GET /widgets/:id returns 404 when the widget belongs to another account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("alice2@example.com");
    const bobSession = await registerAndLogin("bob2@example.com");

    const aliceWidget = await createWidget(
      aliceSession.cookie,
      ALICE_WIDGET_NAME
    );

    const app = createApp();
    const res = await app.handle(
      new Request(`${WIDGETS_URL}/${aliceWidget.id}`, {
        headers: { cookie: bobSession.cookie },
      })
    );

    expect(res.status).toBe(404);
  });

  test("PATCH /widgets/:id returns 404 when the widget belongs to another account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("alice3@example.com");
    const bobSession = await registerAndLogin("bob3@example.com");

    const aliceWidget = await createWidget(
      aliceSession.cookie,
      ALICE_WIDGET_NAME
    );

    const app = createApp();
    const res = await app.handle(
      new Request(`${WIDGETS_URL}/${aliceWidget.id}`, {
        method: "PATCH",
        headers: {
          cookie: bobSession.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "hijacked" }),
      })
    );

    expect(res.status).toBe(404);

    const rows = await db.select().from(widgets);
    const alicesRow = rows.find((row) => row.id === aliceWidget.id);

    expect(alicesRow?.name).toBe(ALICE_WIDGET_NAME);
  });

  test("DELETE /widgets/:id returns 404 when the widget belongs to another account; row is preserved", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("alice4@example.com");
    const bobSession = await registerAndLogin("bob4@example.com");

    const aliceWidget = await createWidget(
      aliceSession.cookie,
      ALICE_WIDGET_NAME
    );

    const app = createApp();
    const res = await app.handle(
      new Request(`${WIDGETS_URL}/${aliceWidget.id}`, {
        method: "DELETE",
        headers: { cookie: bobSession.cookie },
      })
    );

    expect(res.status).toBe(404);

    const rows = await db.select().from(widgets);

    expect(rows.find((row) => row.id === aliceWidget.id)).toBeDefined();
  });

  test("POST /widgets creates a widget in the caller's account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("create-widget@example.com");
    const app = createApp();
    const res = await app.handle(
      new Request(WIDGETS_URL, {
        method: "POST",
        headers: {
          cookie: aliceSession.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "new-widget" }),
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isWidget(body)) {
      throw new Error("expected a widget envelope");
    }

    expect(body.name).toBe("new-widget");
    expect(body.accountId).toBe(aliceSession.accountId);
  });

  test("GET /widgets/:id returns 200 for the owner's widget", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("get-own@example.com");
    const widget = await createWidget(aliceSession.cookie, "own-widget");
    const app = createApp();
    const res = await app.handle(
      new Request(`${WIDGETS_URL}/${widget.id}`, {
        headers: { cookie: aliceSession.cookie },
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isWidget(body)) {
      throw new Error("expected a widget envelope");
    }

    expect(body.id).toBe(widget.id);
  });

  test("PATCH /widgets/:id updates the widget name", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("patch-own@example.com");
    const widget = await createWidget(aliceSession.cookie, "old-name");
    const app = createApp();
    const res = await app.handle(
      new Request(`${WIDGETS_URL}/${widget.id}`, {
        method: "PATCH",
        headers: {
          cookie: aliceSession.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "new-name" }),
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isWidget(body)) {
      throw new Error("expected a widget envelope");
    }

    expect(body.name).toBe("new-name");
  });

  test("DELETE /widgets/:id returns 204 for the owner", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("delete-own@example.com");
    const widget = await createWidget(aliceSession.cookie, "to-delete");
    const app = createApp();
    const res = await app.handle(
      new Request(`${WIDGETS_URL}/${widget.id}`, {
        method: "DELETE",
        headers: { cookie: aliceSession.cookie },
      })
    );

    expect(res.status).toBe(204);
  });
});

describe("widgets routes — ACL enforcement", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    clearMembershipCacheForTests();
  });

  test("PATCH returns 403 when the caller is a viewer", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("viewer-patch@example.com");
    const widget = await createWidget(aliceSession.cookie, "read-only");

    await db
      .update(accountMemberships)
      .set({ role: "viewer" })
      .where(eq(accountMemberships.userId, aliceSession.userId));

    clearMembershipCacheForTests();
    const app = createApp();
    const res = await app.handle(
      new Request(`${WIDGETS_URL}/${widget.id}`, {
        method: "PATCH",
        headers: {
          cookie: aliceSession.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "nope" }),
      })
    );

    expect(res.status).toBe(403);
  });

  test("POST returns 402 when max_widgets is reached", async () => {
    if (!(await requireDb())) {
      return;
    }

    const aliceSession = await registerAndLogin("widget-limit@example.com");
    const app = createApp();

    for (let i = 0; i < 5; i += 1) {
      await createWidget(aliceSession.cookie, `widget-${String(i)}`);
    }

    const res = await app.handle(
      new Request(WIDGETS_URL, {
        method: "POST",
        headers: {
          cookie: aliceSession.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "one-too-many" }),
      })
    );

    expect(res.status).toBe(402);
  });
});
