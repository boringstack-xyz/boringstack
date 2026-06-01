import { beforeEach, describe, expect, test } from "bun:test";

import { seedVerifiedUser } from "../../helpers/auth";
import { createApp } from "../../../src/config/app";
import { cleanDatabase, db, eq, requireDb, users } from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";

const extractCookiePair = (setCookie: string | null, name: string): string => {
  if (setCookie === null) {
    return "";
  }

  const match = new RegExp(`${name}=[^;,\\s]+`).exec(setCookie);

  return match?.[0] ?? "";
};

async function registerAndLogin(
  email: string,
  role: "platform_admin" | "user" = "user"
): Promise<{ authCookie: string }> {
  const { user } = await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Admin",
    lastName: "Test",
  });

  if (role === "platform_admin") {
    await db
      .update(users)
      .set({ isPlatformAdmin: true })
      .where(eq(users.id, user.id));
  }

  const app = createApp();
  const loginRes = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  const authCookie = extractCookiePair(
    loginRes.headers.get("set-cookie"),
    "auth_token"
  );

  return { authCookie };
}

describe("GET /api/v1/admin/queues — requirePlatformAdmin()", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns 200 for a platform-admin user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { authCookie } = await registerAndLogin(
      "admin@example.com",
      "platform_admin"
    );

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/admin/queues", {
        headers: { cookie: authCookie },
      })
    );

    expect(res.status).toBe(200);
  });

  test("returns 403 for a regular user without platform-admin", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { authCookie } = await registerAndLogin("user@example.com", "user");

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/admin/queues", {
        headers: { cookie: authCookie },
      })
    );

    expect(res.status).toBe(403);
  });

  test("returns 401 when no auth cookie is presented", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/admin/queues")
    );

    expect(res.status).toBe(401);
  });
});
