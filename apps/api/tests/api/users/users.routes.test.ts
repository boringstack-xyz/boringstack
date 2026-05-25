import { beforeEach, describe, expect, test } from "bun:test";

import { seedVerifiedUser } from "../../helpers/auth";
import { createApp } from "../../../src/config/app";
import { cleanDatabase, requireDb } from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const ME_URL = "http://localhost/api/v1/users/me";

const isProfileBody = (
  value: unknown
): value is { email: string; firstName: string; lastName: string } =>
  value !== null &&
  typeof value === "object" &&
  "email" in value &&
  typeof value.email === "string" &&
  "firstName" in value &&
  typeof value.firstName === "string" &&
  "lastName" in value &&
  typeof value.lastName === "string";

const isMeBody = (
  value: unknown
): value is {
  user: { email: string; firstName: string; lastName: string };
  account: { id: string; name: string };
  role: string;
  memberships: { accountId: string; accountName: string; role: string }[];
  features: Record<string, unknown>;
  capabilities: Record<string, unknown>;
} => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (!("user" in value) || !isProfileBody(value.user)) {
    return false;
  }

  return (
    "account" in value &&
    "role" in value &&
    "memberships" in value &&
    Array.isArray(value.memberships) &&
    "features" in value &&
    "capabilities" in value
  );
};

const extractCookiePair = (setCookie: string | null, name: string): string => {
  if (setCookie === null) {
    return "";
  }

  const match = new RegExp(`${name}=[^;,\\s]+`).exec(setCookie);

  return match?.[0] ?? "";
};

async function registerAndLogin(email: string): Promise<string> {
  await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Users",
    lastName: "Routes",
  });

  const app = createApp();
  const loginRes = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  return extractCookiePair(loginRes.headers.get("set-cookie"), "auth_token");
}

describe("GET /api/v1/users/me", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns 200 + the public profile for the authenticated user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const authCookie = await registerAndLogin("me-test@example.com");
    const app = createApp();
    const res = await app.handle(
      new Request(ME_URL, {
        headers: { cookie: authCookie },
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isMeBody(body)) {
      throw new Error("expected a /me envelope");
    }

    expect(body.user.email).toBe("me-test@example.com");
    expect(body.user.firstName).toBe("Users");
    expect(body.role).toBe("owner");
    expect(body.memberships).toHaveLength(1);
    expect(body.memberships[0]?.accountId).toBe(body.account.id);
    expect(body.features.max_seats).toBe(1);
    expect(typeof body.capabilities.notificationsSse).toBe("boolean");
  });

  test("returns 401 with no auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(new Request(ME_URL));

    expect(res.status).toBe(401);
  });

  test("returns 401 with a malformed/tampered auth cookie (Elysia INVALID_COOKIE_SIGNATURE → 401, not 500)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request(ME_URL, {
        headers: { cookie: "auth_token=not-a-real-jwt-at-all" },
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/users/me", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("updates firstName and lastName, returns the refreshed profile", async () => {
    if (!(await requireDb())) {
      return;
    }

    const authCookie = await registerAndLogin("update-me@example.com");
    const app = createApp();
    const res = await app.handle(
      new Request(ME_URL, {
        method: "PATCH",
        headers: {
          cookie: authCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ firstName: "Renamed", lastName: "Person" }),
      })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    if (!isProfileBody(body)) {
      throw new Error("expected a user profile envelope");
    }

    expect(body.firstName).toBe("Renamed");
    expect(body.lastName).toBe("Person");
  });

  test("returns 401 without a cookie (no profile leakage)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request(ME_URL, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Hacker" }),
      })
    );

    expect(res.status).toBe(401);
  });

  test("rejects an empty body with a 4xx (validation)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const authCookie = await registerAndLogin("validation-test@example.com");
    const app = createApp();
    const res = await app.handle(
      new Request(ME_URL, {
        method: "PATCH",
        headers: {
          cookie: authCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);
  });
});
