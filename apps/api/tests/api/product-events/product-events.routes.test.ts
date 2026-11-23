import { beforeEach, describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  cleanDatabase,
  db,
  eq,
  productEvents,
  requireDb,
} from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const ROBOT_DOMAIN = "robot.boringstack.invalid";

const findAuthCookie = (setCookies: readonly string[]): string => {
  const raw = setCookies.find((value) => value.startsWith("auth_token="));
  const semi = raw?.indexOf(";") ?? -1;

  return raw === undefined ? "" : semi === -1 ? raw : raw.slice(0, semi);
};

const loginCookie = async (
  app: ReturnType<typeof createApp>,
  email: string
): Promise<{ userId: string; cookie: string }> => {
  const { user } = await seedVerifiedUser({ email, password: PASSWORD });
  const res = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  return {
    userId: user.id,
    cookie: findAuthCookie(res.headers.getSetCookie()),
  };
};

const post = (
  app: ReturnType<typeof createApp>,
  cookie: string,
  body: unknown
): Promise<Response> =>
  app.handle(
    new Request("http://localhost/api/v1/product-events/", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    })
  );

describe("product events routes", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("records an allowlisted event for the caller's account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const member = await loginCookie(app, "events-member@example.com");
    const res = await post(app, member.cookie, {
      kind: "checkout_started",
      context: "pro_monthly",
    });

    expect(res.status).toBe(204);

    const rows = await db
      .select()
      .from(productEvents)
      .where(eq(productEvents.userId, member.userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("checkout_started");
    expect(rows[0]?.context).toBe("pro_monthly");
  });

  test("refuses a kind outside the allowlist and records nothing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const member = await loginCookie(app, "events-unknown@example.com");
    const res = await post(app, member.cookie, { kind: "email_typed" });

    expect(res.status).toBe(400);
    expect(await db.select().from(productEvents)).toHaveLength(0);
  });

  test("records nothing for a verification robot account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const robot = await loginCookie(
      app,
      `robot-${crypto.randomUUID()}@${ROBOT_DOMAIN}`
    );
    const res = await post(app, robot.cookie, { kind: "sign_up_completed" });

    expect(res.status).toBe(204);
    expect(await db.select().from(productEvents)).toHaveLength(0);
  });
});
